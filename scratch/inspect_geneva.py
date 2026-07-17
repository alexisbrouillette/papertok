import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print("Navigating to Geneva page...")
        await page.goto("https://archive-ouverte.unige.ch/unige:24139", wait_until="networkidle")
        
        # Print page title
        print("Page Title:", await page.title())
        
        # Extract and print all anchor tags with their text and href
        links = await page.eval_on_selector_all("a", "elements => elements.map(el => ({href: el.href, text: el.innerText.trim()}))")
        print(f"Found {len(links)} links:")
        for idx, link in enumerate(links):
            if any(k in link['href'].lower() for k in ["attachment", "pdf", "download", "unige"]):
                print(f"  [{idx}] Text: '{link['text']}' | Href: {link['href']}")
        
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
