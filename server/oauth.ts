import { Router, Request, Response } from "express";
import { storage } from "./storage";
import crypto from "crypto";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    oauthState?: string;
    vkCodeVerifier?: string;
  }
}

const router = Router();

function getBaseUrl(req: Request): string {
  const host = req.get('host');
  if (host) {
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    return `${protocol}://${host}`;
  }
  return "https://securelex.ru";
}

function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

async function getOAuthConfig(provider: "vk" | "yandex") {
  const setting = await storage.getOAuthSetting(provider);
  if (!setting || !setting.enabled || !setting.clientId || !setting.clientSecret) {
    return null;
  }
  return {
    clientId: setting.clientId,
    clientSecret: setting.clientSecret,
  };
}

router.get("/vk", async (req: Request, res: Response) => {
  const config = await getOAuthConfig("vk");
  if (!config) {
    return res.status(500).json({ error: "VK OAuth не настроен или отключён" });
  }

  const state = crypto.randomBytes(32).toString('base64url');
  const { codeVerifier, codeChallenge } = generatePKCE();
  
  req.session.oauthState = state;
  req.session.vkCodeVerifier = codeVerifier;

  const redirectUri = `${getBaseUrl(req)}/api/oauth/vk/callback`;
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    state: state,
    scope: 'email vkid.personal_info',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `https://id.vk.ru/authorize?${params.toString()}`;
  console.log(`[VK ID] Init: redirectUri=${redirectUri}, state=${state}, sessionId=${req.sessionID}`);
  
  req.session.save((err) => {
    if (err) {
      console.error("[VK ID] Session save error:", err);
      return res.status(500).json({ error: "Session error" });
    }
    res.redirect(authUrl);
  });
});

router.get("/vk/callback", async (req: Request, res: Response) => {
  try {
    const { payload, error, error_description } = req.query;
    
    console.log("[VK ID Callback] Query params:", req.query);

    if (error) {
      console.error("[VK ID] Error:", error, error_description);
      return res.redirect("/auth?error=vk_denied");
    }

    let code: string | undefined;
    let state: string | undefined;
    let deviceId: string | undefined;

    if (payload && typeof payload === 'string') {
      try {
        const payloadData = JSON.parse(payload);
        code = payloadData.code;
        state = payloadData.state;
        deviceId = payloadData.device_id;
        console.log("[VK ID] Parsed payload:", { code: code?.substring(0, 10) + '...', state, deviceId });
      } catch (e) {
        console.error("[VK ID] Failed to parse payload:", e);
        return res.redirect("/auth?error=vk_invalid_payload");
      }
    } else {
      code = req.query.code as string;
      state = req.query.state as string;
      deviceId = req.query.device_id as string;
    }

    if (!code) {
      console.error("[VK ID] No code received");
      return res.redirect("/auth?error=vk_no_code");
    }

    if (state !== req.session.oauthState) {
      console.error("[VK ID] Invalid state. Expected:", req.session.oauthState, "Got:", state);
      return res.redirect("/auth?error=vk_invalid_state");
    }

    const codeVerifier = req.session.vkCodeVerifier;
    if (!codeVerifier) {
      console.error("[VK ID] No code_verifier in session");
      return res.redirect("/auth?error=vk_no_verifier");
    }

    delete req.session.oauthState;
    delete req.session.vkCodeVerifier;

    const config = await getOAuthConfig("vk");
    if (!config) {
      return res.redirect("/auth?error=vk_not_configured");
    }

    const redirectUri = `${getBaseUrl(req)}/api/oauth/vk/callback`;
    
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      code_verifier: codeVerifier,
      client_id: config.clientId,
      redirect_uri: redirectUri,
      device_id: deviceId || '',
      state: state || '',
    });

    console.log("[VK ID] Exchanging code for token...");
    const tokenResponse = await fetch("https://id.vk.ru/oauth2/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json();
    console.log("[VK ID] Token response:", { ...tokenData, access_token: tokenData.access_token ? '***' : undefined });

    if (tokenData.error) {
      console.error("[VK ID] Token error:", tokenData);
      return res.redirect("/auth?error=vk_token_failed");
    }

    const { access_token, user_id } = tokenData;

    const userInfoResponse = await fetch("https://api.vk.ru/method/users.get", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${access_token}`,
      },
      body: new URLSearchParams({
        fields: "photo_100,first_name,last_name",
        v: "5.199",
      }).toString(),
    });

    const userInfoData = await userInfoResponse.json();
    console.log("[VK ID] User info response:", userInfoData);

    if (userInfoData.error || !userInfoData.response?.[0]) {
      console.error("[VK ID] User info error:", userInfoData);
      return res.redirect("/auth?error=vk_userinfo_failed");
    }

    const vkUser = userInfoData.response[0];
    const vkId = String(user_id || vkUser.id);
    const name = `${vkUser.first_name || ''} ${vkUser.last_name || ''}`.trim() || 'VK User';
    const avatarUrl = vkUser.photo_100;

    let email: string | undefined;
    try {
      const emailResponse = await fetch("https://api.vk.ru/method/account.getProfileInfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Bearer ${access_token}`,
        },
        body: new URLSearchParams({ v: "5.199" }).toString(),
      });
      const emailData = await emailResponse.json();
      if (emailData.response?.email) {
        email = emailData.response.email;
      }
    } catch (e) {
      console.log("[VK ID] Could not get email:", e);
    }

    let user = await storage.getUserByVkId(vkId);

    if (!user && email) {
      user = await storage.getUserByEmail(email);
      if (user) {
        await storage.updateUser(user.id, { vkId, avatarUrl, oauthProvider: "vk" });
      }
    }

    if (!user) {
      const userEmail = email || `vk_${vkId}@securelex.ru`;
      user = await storage.createOAuthUser({
        name,
        email: userEmail,
        vkId,
        avatarUrl,
        oauthProvider: "vk",
      });
    }

    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error("[VK ID] Session save error:", err);
        return res.redirect("/auth?error=session_failed");
      }
      console.log(`[VK ID] User logged in: ${user!.id}`);
      res.redirect("/dashboard");
    });
  } catch (error) {
    console.error("[VK ID] Callback error:", error);
    res.redirect("/auth?error=vk_failed");
  }
});

router.get("/yandex", async (req: Request, res: Response) => {
  const config = await getOAuthConfig("yandex");
  if (!config) {
    return res.status(500).json({ error: "Яндекс OAuth не настроен или отключён" });
  }

  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  const redirectUri = `${getBaseUrl(req)}/api/oauth/yandex/callback`;

  const authUrl = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  console.log(`[Yandex OAuth] Init: redirectUri=${redirectUri}, state=${state}, sessionId=${req.sessionID}`);
  
  req.session.save((err) => {
    if (err) {
      console.error("[Yandex OAuth] Session save error:", err);
      return res.status(500).json({ error: "Session error" });
    }
    res.redirect(authUrl);
  });
});

router.get("/yandex/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    console.log(`[Yandex OAuth] Callback: state=${state}, sessionState=${req.session.oauthState}, sessionId=${req.sessionID}`);

    if (error) {
      console.error("[Yandex OAuth] Error:", error, error_description);
      return res.redirect("/auth?error=yandex_denied");
    }

    if (!code || typeof code !== "string") {
      return res.redirect("/auth?error=yandex_no_code");
    }

    if (state !== req.session.oauthState) {
      console.error(`[Yandex OAuth] Invalid state. Expected: ${req.session.oauthState}, Got: ${state}`);
      return res.redirect("/auth?error=yandex_invalid_state");
    }

    delete req.session.oauthState;

    const config = await getOAuthConfig("yandex");
    if (!config) {
      return res.redirect("/auth?error=yandex_not_configured");
    }

    const redirectUri = `${getBaseUrl(req)}/api/oauth/yandex/callback`;
    
    const tokenResponse = await fetch("https://oauth.yandex.ru/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("[Yandex OAuth] Token error:", tokenData);
      return res.redirect("/auth?error=yandex_token_failed");
    }

    const { access_token } = tokenData;

    const userInfoResponse = await fetch("https://login.yandex.ru/info?format=json", {
      headers: {
        Authorization: `OAuth ${access_token}`,
      },
    });

    const userInfo = await userInfoResponse.json();

    if (!userInfo.id) {
      console.error("[Yandex OAuth] User info error:", userInfo);
      return res.redirect("/auth?error=yandex_userinfo_failed");
    }

    const yandexId = String(userInfo.id);
    const name = userInfo.real_name || userInfo.display_name || userInfo.login || "User";
    const email = userInfo.default_email || `yandex_${yandexId}@securelex.ru`;
    const avatarUrl = userInfo.default_avatar_id 
      ? `https://avatars.yandex.net/get-yapic/${userInfo.default_avatar_id}/islands-200`
      : undefined;

    let user = await storage.getUserByYandexId(yandexId);

    if (!user && email) {
      user = await storage.getUserByEmail(email);
      if (user) {
        await storage.updateUser(user.id, { yandexId, avatarUrl, oauthProvider: "yandex" });
      }
    }

    if (!user) {
      user = await storage.createOAuthUser({
        name,
        email,
        yandexId,
        avatarUrl,
        oauthProvider: "yandex",
      });
    }

    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error("[Yandex OAuth] Session save error:", err);
        return res.redirect("/auth?error=session_failed");
      }
      console.log(`[Yandex OAuth] User logged in: ${user!.id}`);
      res.redirect("/dashboard");
    });
  } catch (error) {
    console.error("[Yandex OAuth] Callback error:", error);
    res.redirect("/auth?error=yandex_failed");
  }
});

router.get("/status", async (req: Request, res: Response) => {
  const [vkConfig, yandexConfig] = await Promise.all([
    getOAuthConfig("vk"),
    getOAuthConfig("yandex"),
  ]);
  
  res.json({
    vk: !!vkConfig,
    yandex: !!yandexConfig,
  });
});

router.get("/vk/config", async (req: Request, res: Response) => {
  const config = await getOAuthConfig("vk");
  if (!config) {
    return res.status(500).json({ error: "VK OAuth не настроен" });
  }

  const state = crypto.randomBytes(32).toString('base64url');
  const { codeVerifier, codeChallenge } = generatePKCE();
  
  req.session.oauthState = state;
  req.session.vkCodeVerifier = codeVerifier;

  const redirectUri = `${getBaseUrl(req)}/api/oauth/vk/callback`;

  req.session.save((err) => {
    if (err) {
      console.error("[VK ID Config] Session save error:", err);
      return res.status(500).json({ error: "Session error" });
    }
    
    res.json({
      app: parseInt(config.clientId, 10),
      redirectUrl: redirectUri,
      state: state,
      codeChallenge: codeChallenge,
      scope: 'email vkid.personal_info',
    });
  });
});

router.post("/vk/exchange", async (req: Request, res: Response) => {
  try {
    const { code, deviceId, state } = req.body;

    if (!code || !deviceId) {
      return res.status(400).json({ error: "Missing code or deviceId" });
    }

    if (state !== req.session.oauthState) {
      console.error("[VK ID Exchange] Invalid state. Expected:", req.session.oauthState, "Got:", state);
      return res.status(400).json({ error: "Invalid state" });
    }

    const codeVerifier = req.session.vkCodeVerifier;
    if (!codeVerifier) {
      console.error("[VK ID Exchange] No code_verifier in session");
      return res.status(400).json({ error: "No verifier" });
    }

    delete req.session.oauthState;
    delete req.session.vkCodeVerifier;

    const config = await getOAuthConfig("vk");
    if (!config) {
      return res.status(500).json({ error: "VK not configured" });
    }

    const redirectUri = `${getBaseUrl(req)}/api/oauth/vk/callback`;
    
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      code_verifier: codeVerifier,
      client_id: config.clientId,
      redirect_uri: redirectUri,
      device_id: deviceId,
      state: state || '',
    });

    console.log("[VK ID Exchange] Exchanging code for token...");
    const tokenResponse = await fetch("https://id.vk.ru/oauth2/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json();
    console.log("[VK ID Exchange] Token response:", { ...tokenData, access_token: tokenData.access_token ? '***' : undefined });

    if (tokenData.error) {
      console.error("[VK ID Exchange] Token error:", tokenData);
      return res.status(400).json({ error: "Token exchange failed", details: tokenData.error });
    }

    const { access_token, user_id } = tokenData;

    const userInfoResponse = await fetch("https://api.vk.ru/method/users.get", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${access_token}`,
      },
      body: new URLSearchParams({
        fields: "photo_100,first_name,last_name",
        v: "5.199",
      }).toString(),
    });

    const userInfoData = await userInfoResponse.json();

    if (userInfoData.error || !userInfoData.response?.[0]) {
      console.error("[VK ID Exchange] User info error:", userInfoData);
      return res.status(400).json({ error: "Failed to get user info" });
    }

    const vkUser = userInfoData.response[0];
    const vkId = String(user_id || vkUser.id);
    const name = `${vkUser.first_name || ''} ${vkUser.last_name || ''}`.trim() || 'VK User';
    const avatarUrl = vkUser.photo_100;

    let email: string | undefined;
    try {
      const emailResponse = await fetch("https://api.vk.ru/method/account.getProfileInfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Bearer ${access_token}`,
        },
        body: new URLSearchParams({ v: "5.199" }).toString(),
      });
      const emailData = await emailResponse.json();
      if (emailData.response?.email) {
        email = emailData.response.email;
      }
    } catch (e) {
      console.log("[VK ID Exchange] Could not get email:", e);
    }

    let user = await storage.getUserByVkId(vkId);

    if (!user && email) {
      user = await storage.getUserByEmail(email);
      if (user) {
        await storage.updateUser(user.id, { vkId, avatarUrl, oauthProvider: "vk" });
      }
    }

    if (!user) {
      const userEmail = email || `vk_${vkId}@securelex.ru`;
      user = await storage.createOAuthUser({
        name,
        email: userEmail,
        vkId,
        avatarUrl,
        oauthProvider: "vk",
      });
    }

    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error("[VK ID Exchange] Session save error:", err);
        return res.status(500).json({ error: "Session save failed" });
      }
      console.log(`[VK ID Exchange] User logged in: ${user!.id}`);
      res.json({ success: true, user: { id: user!.id, name: user!.name } });
    });
  } catch (error) {
    console.error("[VK ID Exchange] Error:", error);
    res.status(500).json({ error: "Exchange failed" });
  }
});

export default router;
