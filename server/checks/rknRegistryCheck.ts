/**
 * Проверка организации в реестре операторов персональных данных Роскомнадзора.
 * https://pd.rkn.gov.ru/operators-registry/operators-list/
 * 
 * ВАЖНО: Официального API у РКН нет. Сайт защищён от ботов.
 * Этот модуль использует GigaChat/OpenAI для анализа результатов поиска
 * или прямой парсинг при наличии доступа.
 */

export interface RKNOperatorInfo {
  found: boolean;
  inn: string;
  registrationNumber?: string;
  name?: string;
  registrationDate?: string;
  startDate?: string;
  operatorType?: string;
  region?: string;
  address?: string;
  basis?: string;
  error?: string;
  sourceUrl?: string;
  method?: 'direct' | 'ai_search' | 'manual';
}

export interface RKNCheckResult {
  success: boolean;
  data: RKNOperatorInfo;
  recommendations: string[];
  lawBasis: string;
  limitations: string[];
}

const FETCH_TIMEOUT = 15000;

/**
 * Валидация ИНН (10 или 12 цифр).
 */
export function validateINN(inn: string): { valid: boolean; error?: string } {
  const cleaned = inn.replace(/\s+/g, '').trim();
  
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'ИНН должен содержать только цифры' };
  }
  
  if (cleaned.length !== 10 && cleaned.length !== 12) {
    return { valid: false, error: 'ИНН должен содержать 10 (юр.лицо) или 12 (ИП/физ.лицо) цифр' };
  }
  
  // Проверка контрольной суммы для ИНН юрлица (10 цифр)
  if (cleaned.length === 10) {
    const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned[i]) * weights[i];
    }
    const control = (sum % 11) % 10;
    if (control !== parseInt(cleaned[9])) {
      return { valid: false, error: 'Некорректная контрольная сумма ИНН' };
    }
  }
  
  // Проверка контрольной суммы для ИНН ИП/физлица (12 цифр)
  if (cleaned.length === 12) {
    const weights1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const weights2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    
    let sum1 = 0, sum2 = 0;
    for (let i = 0; i < 10; i++) {
      sum1 += parseInt(cleaned[i]) * weights1[i];
    }
    for (let i = 0; i < 11; i++) {
      sum2 += parseInt(cleaned[i]) * weights2[i];
    }
    
    const control1 = (sum1 % 11) % 10;
    const control2 = (sum2 % 11) % 10;
    
    if (control1 !== parseInt(cleaned[10]) || control2 !== parseInt(cleaned[11])) {
      return { valid: false, error: 'Некорректная контрольная сумма ИНН' };
    }
  }
  
  return { valid: true };
}

/**
 * Попытка прямого запроса к реестру РКН.
 * Может не работать из-за защиты от ботов.
 */
async function tryDirectCheck(inn: string): Promise<RKNOperatorInfo | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    
    const baseUrl = 'https://pd.rkn.gov.ru/operators-registry/operators-list/';
    
    // Сначала загружаем страницу для получения cookies
    const pageResponse = await fetch(baseUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (pageResponse.status !== 200) {
      return null;
    }
    
    const html = await pageResponse.text();
    
    // Проверяем на защиту от ботов
    if (html.includes('Проверка безопасности') || html.includes('captcha')) {
      return null;
    }
    
    // Если страница загрузилась, пробуем POST запрос
    const formData = new URLSearchParams();
    formData.append('inn', inn);
    formData.append('action', 'search');
    
    const searchController = new AbortController();
    const searchTimeoutId = setTimeout(() => searchController.abort(), FETCH_TIMEOUT);
    
    const searchResponse = await fetch(baseUrl, {
      method: 'POST',
      signal: searchController.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    
    clearTimeout(searchTimeoutId);
    
    const searchHtml = await searchResponse.text();
    
    // Парсим результаты
    if (searchHtml.includes('Найдено: 0') || searchHtml.includes('не найден')) {
      return {
        found: false,
        inn,
        method: 'direct',
        sourceUrl: baseUrl,
      };
    }
    
    // Ищем регистрационный номер
    const regMatch = searchHtml.match(/(\d{2}-\d+-\d+)/);
    const nameMatch = searchHtml.match(/(ООО|АО|ПАО|ЗАО|ИП)\s*[«"]?([^»"<]+)[»"]?/i);
    const dateMatch = searchHtml.match(/(\d{2}\.\d{2}\.\d{4})/);
    
    if (regMatch) {
      return {
        found: true,
        inn,
        registrationNumber: regMatch[1],
        name: nameMatch ? `${nameMatch[1]} ${nameMatch[2]}`.trim() : undefined,
        registrationDate: dateMatch ? dateMatch[1] : undefined,
        method: 'direct',
        sourceUrl: baseUrl,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[RKN-CHECK] Direct check error:', error);
    return null;
  }
}

/**
 * Генерация рекомендаций на основе результата проверки.
 */
function generateRecommendations(result: RKNOperatorInfo): string[] {
  const recommendations: string[] = [];
  
  if (!result.found && !result.error) {
    recommendations.push(
      'Организация не найдена в реестре операторов персональных данных Роскомнадзора',
      'Согласно ст. 22 ФЗ-152, оператор обязан уведомить Роскомнадзор о намерении обрабатывать персональные данные',
      'Рекомендуется подать уведомление через портал pd.rkn.gov.ru',
      'Срок рассмотрения уведомления: до 30 дней',
      'Штраф за обработку ПДн без уведомления: до 5 000 руб. (КоАП РФ ст. 13.11)'
    );
  } else if (result.found) {
    recommendations.push(
      'Организация зарегистрирована в реестре операторов ПДн Роскомнадзора',
      'Убедитесь, что информация в реестре актуальна',
      'При изменении сведений об обработке ПДн необходимо подать изменения в РКН в течение 10 дней'
    );
  }
  
  return recommendations;
}

/**
 * Основная функция проверки организации в реестре РКН.
 */
export async function checkRKNRegistry(inn: string): Promise<RKNCheckResult> {
  const cleanedINN = inn.replace(/\s+/g, '').trim();
  
  // Валидация ИНН
  const validation = validateINN(cleanedINN);
  if (!validation.valid) {
    return {
      success: false,
      data: {
        found: false,
        inn: cleanedINN,
        error: validation.error,
      },
      recommendations: [],
      lawBasis: '152-ФЗ ст. 22',
      limitations: ['Проверка не выполнена из-за некорректного ИНН'],
    };
  }
  
  // Пробуем прямой запрос
  const directResult = await tryDirectCheck(cleanedINN);
  
  if (directResult) {
    return {
      success: true,
      data: directResult,
      recommendations: generateRecommendations(directResult),
      lawBasis: '152-ФЗ ст. 22',
      limitations: [],
    };
  }
  
  // Если прямой запрос не сработал, возвращаем инструкцию для ручной проверки
  return {
    success: true,
    data: {
      found: false,
      inn: cleanedINN,
      method: 'manual',
      sourceUrl: `https://pd.rkn.gov.ru/operators-registry/operators-list/?inn=${cleanedINN}`,
      error: 'Автоматическая проверка недоступна из-за защиты сайта РКН от ботов',
    },
    recommendations: [
      'Для проверки перейдите по ссылке и введите ИНН вручную',
      `Ссылка: https://pd.rkn.gov.ru/operators-registry/operators-list/`,
      'Или используйте Python-скрипт с Playwright для автоматизации',
    ],
    lawBasis: '152-ФЗ ст. 22',
    limitations: [
      'Сайт РКН защищён от автоматических запросов',
      'Требуется ручная проверка или использование браузерной автоматизации (Playwright)',
    ],
  };
}

export default checkRKNRegistry;
