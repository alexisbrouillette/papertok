import asyncio
import urllib.parse
from playwright.async_api import async_playwright

async def inspect():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        query = "Spatial Nonstationarity in Phenological Responses of Nearctic Birds to Climate Variability."
        search_url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
        print(f"Loading URL: {search_url}")
        
        await page.goto(search_url, wait_until="networkidle")
        await page.screenshot(path="scratch/google_search.png")
        print("Saved screenshot to scratch/google_search.png")
        
        # Print all visible links
        links = await page.eval_on_selector_all("a", "elements => elements.map(el => ({href: el.href, text: el.innerText}))")
        print(f"Found {len(links)} links on the page.")
        for l in links[:20]:
            if l['href'].startswith('http'):
                print(f" - {l['href']} ({l['text'][:30]})")
                
        await browser.close()

if __name__ == '__main__':
    asyncio.run(inspect())
