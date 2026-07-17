import sys
import json
import asyncio
import urllib.parse
from playwright.async_api import async_playwright

async def search_google(query):
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        page = await context.new_page()
        
        search_url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
        await page.goto(search_url, wait_until="domcontentloaded", timeout=25000)
        await page.wait_for_timeout(1000)
        
        # Extract all link Hrefs on page
        hrefs = await page.eval_on_selector_all("a", """elements => 
            elements.map(el => el.href)
        """)
        
        await browser.close()
        
        # Filter and clean up URLs
        clean_urls = []
        for href in hrefs:
            if not href or not href.startswith("http"):
                continue
            href_lower = href.lower()
            # Skip google domains, search cache, etc.
            if "google.com" in href_lower or "googleusercontent.com" in href_lower or "youtube.com" in href_lower:
                continue
            if href not in clean_urls:
                clean_urls.append(href)
                
        return clean_urls[:10]  # Return top 10 URLs

if __name__ == '__main__':
    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "ImageNet Classification with Deep Convolutional Neural Networks"
    try:
        urls = asyncio.run(search_google(query))
        print(json.dumps(urls))
    except Exception as e:
        print(json.dumps([]))
