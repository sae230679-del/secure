import { Router, Request, Response } from "express";
import { storage } from "./storage";
import crypto from "crypto";

const router = Router();

const VK_APP_ID = process.env.VK_APP_ID;
const VK_APP_SECRET = process.env.VK_APP_SECRET;
const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID;
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET;

function getBaseUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.DOMAIN) {
    return `https://${process.env.DOMAIN}`;
  }
  return process.env.BASE_URL || "https://securelex.ru";
}

router.get("/vk", (req: Request, res: Response) => {
  if (!VK_APP_ID) {
    return res.status(500).json({ error: "VK OAuth не настроен" });
  }

  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  const redirectUri = `${getBaseUrl()}/api/oauth/vk/callback`;
  const scope = "email";
  const vkVersion = "5.131";

  const authUrl = `https://oauth.vk.com/authorize?client_id=${VK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&display=page&scope=${scope}&response_type=code&v=${vkVersion}&state=${state}`;

  res.redirect(authUrl);
});

router.get("/vk/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error("[VK OAuth] Error:", error, error_description);
      return res.redirect("/auth?error=vk_denied");
    }

    if (!code || typeof code !== "string") {
      return res.redirect("/auth?error=vk_no_code");
    }

    if (state !== req.session.oauthState) {
      console.error("[VK OAuth] Invalid state");
      return res.redirect("/auth?error=vk_invalid_state");
    }

    delete req.session.oauthState;

    if (!VK_APP_ID || !VK_APP_SECRET) {
      return res.redirect("/auth?error=vk_not_configured");
    }

    const redirectUri = `${getBaseUrl()}/api/oauth/vk/callback`;
    const tokenUrl = `https://oauth.vk.com/access_token?client_id=${VK_APP_ID}&client_secret=${VK_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("[VK OAuth] Token error:", tokenData);
      return res.redirect("/auth?error=vk_token_failed");
    }

    const { access_token, user_id, email } = tokenData;

    const userInfoUrl = `https://api.vk.com/method/users.get?user_ids=${user_id}&fields=photo_100,first_name,last_name&access_token=${access_token}&v=5.131`;
    const userInfoResponse = await fetch(userInfoUrl);
    const userInfoData = await userInfoResponse.json();

    if (userInfoData.error || !userInfoData.response?.[0]) {
      console.error("[VK OAuth] User info error:", userInfoData);
      return res.redirect("/auth?error=vk_userinfo_failed");
    }

    const vkUser = userInfoData.response[0];
    const vkId = String(user_id);
    const name = `${vkUser.first_name} ${vkUser.last_name}`.trim();
    const avatarUrl = vkUser.photo_100;

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
        console.error("[VK OAuth] Session save error:", err);
        return res.redirect("/auth?error=session_failed");
      }
      console.log(`[VK OAuth] User logged in: ${user!.id}`);
      res.redirect("/dashboard");
    });
  } catch (error) {
    console.error("[VK OAuth] Callback error:", error);
    res.redirect("/auth?error=vk_failed");
  }
});

router.get("/yandex", (req: Request, res: Response) => {
  if (!YANDEX_CLIENT_ID) {
    return res.status(500).json({ error: "Яндекс OAuth не настроен" });
  }

  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  const redirectUri = `${getBaseUrl()}/api/oauth/yandex/callback`;

  const authUrl = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${YANDEX_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  res.redirect(authUrl);
});

router.get("/yandex/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error("[Yandex OAuth] Error:", error, error_description);
      return res.redirect("/auth?error=yandex_denied");
    }

    if (!code || typeof code !== "string") {
      return res.redirect("/auth?error=yandex_no_code");
    }

    if (state !== req.session.oauthState) {
      console.error("[Yandex OAuth] Invalid state");
      return res.redirect("/auth?error=yandex_invalid_state");
    }

    delete req.session.oauthState;

    if (!YANDEX_CLIENT_ID || !YANDEX_CLIENT_SECRET) {
      return res.redirect("/auth?error=yandex_not_configured");
    }

    const redirectUri = `${getBaseUrl()}/api/oauth/yandex/callback`;
    
    const tokenResponse = await fetch("https://oauth.yandex.ru/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: YANDEX_CLIENT_ID,
        client_secret: YANDEX_CLIENT_SECRET,
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

router.get("/status", (req: Request, res: Response) => {
  res.json({
    vk: !!VK_APP_ID && !!VK_APP_SECRET,
    yandex: !!YANDEX_CLIENT_ID && !!YANDEX_CLIENT_SECRET,
  });
});

export default router;
