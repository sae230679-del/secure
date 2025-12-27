#!/usr/bin/env python3
"""
Проверка организации в реестре операторов персональных данных Роскомнадзора.
https://pd.rkn.gov.ru/operators-registry/operators-list/

Использование:
    python rkn_registry_check.py --inn 7707083893
    python rkn_registry_check.py --inn 7707083893 --json
"""

import argparse
import json
import sys
import time
import re
from dataclasses import dataclass, asdict
from typing import Optional, List
from urllib.parse import urlencode

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

try:
    import requests
    from bs4 import BeautifulSoup
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


@dataclass
class RKNOperatorInfo:
    """Информация об операторе из реестра РКН."""
    found: bool
    inn: str
    registration_number: Optional[str] = None
    name: Optional[str] = None
    registration_date: Optional[str] = None
    start_date: Optional[str] = None
    operator_type: Optional[str] = None
    region: Optional[str] = None
    address: Optional[str] = None
    basis: Optional[str] = None
    error: Optional[str] = None
    source_url: Optional[str] = None


def validate_inn(inn: str) -> bool:
    """Проверка корректности ИНН (10 или 12 цифр)."""
    inn = inn.strip()
    if not inn.isdigit():
        return False
    if len(inn) not in (10, 12):
        return False
    return True


def check_rkn_registry_playwright(inn: str, headless: bool = True, timeout: int = 30000) -> RKNOperatorInfo:
    """
    Проверка через Playwright (браузерная автоматизация).
    Надёжный метод, обходящий защиту от ботов.
    """
    if not HAS_PLAYWRIGHT:
        return RKNOperatorInfo(
            found=False,
            inn=inn,
            error="Playwright не установлен. Выполните: pip install playwright && playwright install chromium"
        )

    result = RKNOperatorInfo(found=False, inn=inn)
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=headless)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale="ru-RU"
            )
            page = context.new_page()
            
            base_url = "https://pd.rkn.gov.ru/operators-registry/operators-list/"
            page.goto(base_url, wait_until="networkidle", timeout=timeout)
            
            # Ищем форму поиска
            # Пробуем разные селекторы для поля ИНН
            inn_selectors = [
                'input[name="inn"]',
                'input[id*="inn"]',
                'input[placeholder*="ИНН"]',
                '#inn',
                'input[type="text"][name*="inn"]',
            ]
            
            inn_field = None
            for selector in inn_selectors:
                try:
                    inn_field = page.wait_for_selector(selector, timeout=5000)
                    if inn_field:
                        break
                except:
                    continue
            
            if not inn_field:
                # Попробуем найти любое текстовое поле
                inn_field = page.query_selector('input[type="text"]')
            
            if not inn_field:
                result.error = "Не найдено поле ввода ИНН на странице"
                browser.close()
                return result
            
            # Вводим ИНН
            inn_field.fill(inn)
            
            # Ищем кнопку поиска
            search_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Найти")',
                'button:has-text("Поиск")',
                '.search-btn',
                '#search-btn',
            ]
            
            search_btn = None
            for selector in search_selectors:
                try:
                    search_btn = page.query_selector(selector)
                    if search_btn:
                        break
                except:
                    continue
            
            if search_btn:
                search_btn.click()
            else:
                # Пробуем отправить форму через Enter
                inn_field.press("Enter")
            
            # Ждём загрузки результатов
            time.sleep(3)
            page.wait_for_load_state("networkidle", timeout=timeout)
            
            # Парсим результаты
            content = page.content()
            result.source_url = page.url
            
            # Проверяем наличие результатов
            if "Найдено: 0" in content or "не найдено" in content.lower() or "нет данных" in content.lower():
                result.found = False
                browser.close()
                return result
            
            # Ищем таблицу с результатами
            rows = page.query_selector_all('table tr, .result-item, .operator-card')
            
            if rows:
                result.found = True
                
                # Пробуем извлечь данные
                for row in rows:
                    text = row.inner_text()
                    
                    # Регистрационный номер
                    reg_match = re.search(r'(\d{2}-\d+-\d+)', text)
                    if reg_match and not result.registration_number:
                        result.registration_number = reg_match.group(1)
                    
                    # Наименование (обычно первая строка с текстом)
                    if not result.name:
                        lines = text.split('\n')
                        for line in lines:
                            line = line.strip()
                            if len(line) > 10 and not line.isdigit():
                                if 'ООО' in line or 'АО' in line or 'ИП' in line or 'ПАО' in line:
                                    result.name = line
                                    break
                    
                    # Дата регистрации
                    date_match = re.search(r'(\d{2}\.\d{2}\.\d{4})', text)
                    if date_match and not result.registration_date:
                        result.registration_date = date_match.group(1)
            
            browser.close()
            
    except PlaywrightTimeout:
        result.error = "Таймаут при загрузке страницы РКН"
    except Exception as e:
        result.error = f"Ошибка Playwright: {str(e)}"
    
    return result


def check_rkn_registry_requests(inn: str) -> RKNOperatorInfo:
    """
    Попытка проверки через requests (может не работать из-за защиты).
    Fallback метод.
    """
    if not HAS_REQUESTS:
        return RKNOperatorInfo(
            found=False,
            inn=inn,
            error="requests/bs4 не установлены. Выполните: pip install requests beautifulsoup4"
        )
    
    result = RKNOperatorInfo(found=False, inn=inn)
    
    try:
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
        })
        
        # Загружаем главную страницу для получения cookies/токенов
        base_url = "https://pd.rkn.gov.ru/operators-registry/operators-list/"
        resp = session.get(base_url, timeout=15)
        
        if resp.status_code != 200:
            result.error = f"Ошибка загрузки страницы: HTTP {resp.status_code}"
            return result
        
        # Проверяем на защиту от ботов
        if "Проверка безопасности" in resp.text or "captcha" in resp.text.lower():
            result.error = "Сайт требует прохождение проверки безопасности. Используйте Playwright."
            return result
        
        # Пробуем отправить POST запрос
        search_params = {
            'inn': inn,
            'name': '',
            'region': '',
            'action': 'search'
        }
        
        search_resp = session.post(base_url, data=search_params, timeout=15)
        
        if "Найдено: 0" in search_resp.text:
            result.found = False
            return result
        
        # Парсим результаты
        soup = BeautifulSoup(search_resp.text, 'html.parser')
        
        # Ищем таблицу результатов
        table = soup.find('table')
        if table:
            rows = table.find_all('tr')
            if len(rows) > 1:
                result.found = True
                # Извлекаем данные из первой строки результатов
                cells = rows[1].find_all('td')
                if len(cells) >= 2:
                    result.registration_number = cells[0].get_text(strip=True)
                    result.name = cells[1].get_text(strip=True) if len(cells) > 1 else None
        
        result.source_url = search_resp.url
        
    except requests.RequestException as e:
        result.error = f"Ошибка запроса: {str(e)}"
    except Exception as e:
        result.error = f"Ошибка: {str(e)}"
    
    return result


def check_rkn_registry(inn: str, method: str = "auto", headless: bool = True) -> RKNOperatorInfo:
    """
    Проверка организации в реестре операторов РКН.
    
    Args:
        inn: ИНН организации (10 или 12 цифр)
        method: Метод проверки ("playwright", "requests", "auto")
        headless: Запускать браузер в headless режиме
    
    Returns:
        RKNOperatorInfo с результатами проверки
    """
    inn = inn.strip().replace(" ", "")
    
    if not validate_inn(inn):
        return RKNOperatorInfo(
            found=False,
            inn=inn,
            error=f"Некорректный ИНН: {inn}. ИНН должен содержать 10 или 12 цифр."
        )
    
    if method == "playwright" or (method == "auto" and HAS_PLAYWRIGHT):
        return check_rkn_registry_playwright(inn, headless=headless)
    elif method == "requests" or (method == "auto" and HAS_REQUESTS):
        return check_rkn_registry_requests(inn)
    else:
        return RKNOperatorInfo(
            found=False,
            inn=inn,
            error="Нет доступных методов проверки. Установите playwright или requests."
        )


def main():
    parser = argparse.ArgumentParser(
        description="Проверка организации в реестре операторов ПДн Роскомнадзора"
    )
    parser.add_argument("--inn", required=True, help="ИНН организации")
    parser.add_argument("--method", choices=["auto", "playwright", "requests"], 
                       default="auto", help="Метод проверки")
    parser.add_argument("--json", action="store_true", help="Вывод в формате JSON")
    parser.add_argument("--no-headless", action="store_true", 
                       help="Показать браузер (для отладки)")
    
    args = parser.parse_args()
    
    result = check_rkn_registry(
        inn=args.inn,
        method=args.method,
        headless=not args.no_headless
    )
    
    if args.json:
        print(json.dumps(asdict(result), ensure_ascii=False, indent=2))
    else:
        print("\n" + "="*60)
        print(f"Проверка ИНН: {result.inn}")
        print("="*60)
        
        if result.error:
            print(f"ОШИБКА: {result.error}")
        elif result.found:
            print("СТАТУС: Организация НАЙДЕНА в реестре операторов ПДн")
            print("-"*60)
            if result.registration_number:
                print(f"Рег. номер:    {result.registration_number}")
            if result.name:
                print(f"Наименование:  {result.name}")
            if result.registration_date:
                print(f"Дата рег.:     {result.registration_date}")
            if result.region:
                print(f"Регион:        {result.region}")
            if result.source_url:
                print(f"Источник:      {result.source_url}")
        else:
            print("СТАТУС: Организация НЕ НАЙДЕНА в реестре операторов ПДн")
            print("-"*60)
            print("Рекомендация: Если организация обрабатывает персональные данные,")
            print("необходимо подать уведомление в Роскомнадзор согласно ст. 22 ФЗ-152")
        
        print("="*60 + "\n")
    
    # Код возврата: 0 = найден, 1 = не найден, 2 = ошибка
    if result.error:
        sys.exit(2)
    elif result.found:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
