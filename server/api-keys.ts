import { storage } from "./storage";
import { decrypt } from "./crypto";

export async function getApiKey(provider: "gigachat" | "openai" | "yandex"): Promise<string | null> {
  const keyNames: Record<string, string> = {
    gigachat: "gigachat_api_key",
    openai: "openai_api_key",
    yandex: "yandex_iam_token",
  };
  const envVarNames: Record<string, string> = {
    gigachat: "GIGACHATAPIKEY",
    openai: "OPENAIAPIKEY",
    yandex: "YANDEX_IAM_TOKEN",
  };
  const keyName = keyNames[provider];
  const envVarName = envVarNames[provider];
  
  // Try database first
  try {
    const setting = await storage.getSecureSetting(keyName);
    if (setting) {
      const decrypted = decrypt(setting.encryptedValue);
      if (decrypted && decrypted.length > 0) {
        return decrypted;
      }
    }
  } catch (e) {
    console.error(`Failed to get ${provider} key from database:`, e);
  }
  
  // Fallback to environment variable
  const envValue = process.env[envVarName];
  return envValue && envValue.length > 0 ? envValue : null;
}

export async function hasApiKey(provider: "gigachat" | "openai" | "yandex"): Promise<boolean> {
  const key = await getApiKey(provider);
  return key !== null && key.length > 0;
}

export async function getYandexConfig(): Promise<{ modelUri: string; folderId: string }> {
  let modelUri = process.env.YANDEX_GPT_MODEL_URI || "";
  let folderId = process.env.YANDEX_FOLDER_ID || "";
  
  // Try database settings first
  try {
    const modelUriSetting = await storage.getSystemSetting("yandex_model_uri");
    if (modelUriSetting?.value) {
      modelUri = modelUriSetting.value;
    }
    
    const folderIdSetting = await storage.getSystemSetting("yandex_folder_id");
    if (folderIdSetting?.value) {
      folderId = folderIdSetting.value;
    }
  } catch (e) {
    console.error("Failed to get Yandex config from database:", e);
  }
  
  // Default values if not configured
  if (!modelUri) {
    modelUri = "gpt://b1g0000000000000000/yandexgpt-lite";
  }
  
  return { modelUri, folderId };
}
