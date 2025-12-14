import { storage } from "./storage";
import { decrypt } from "./crypto";

export async function getApiKey(provider: "gigachat" | "openai" | "yandex"): Promise<string | null> {
  const keyNames: Record<string, string> = {
    gigachat: "gigachat_api_key",
    openai: "openai_api_key",
    yandex: "yandex_iam_token",
  };
  const envVarNames: Record<string, string> = {
    gigachat: "GIGACHAT_API_KEY",
    openai: "OPENAI_API_KEY",
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
