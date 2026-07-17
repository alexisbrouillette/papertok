import asyncio
import os
from playwright.async_api import async_playwright
from pypdf import PdfReader

async def download_with_playwright(page, url, file_path):
    print(f"  Navigating browser to: {url}")
    try:
        # Only navigate first if it's a landing page (not a direct PDF link)
        is_direct_pdf = url.lower().endswith(".pdf") or "attachment" in url.lower() or "/bitstream/" in url.lower()
        if not is_direct_pdf:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            # If it's the Geneva landing page, find the PDF link dynamically
            if "unige:24139" in url and not url.endswith("ATTACHMENT01"):
                print("  Analyzing Geneva open archive landing page...")
                links = await page.eval_on_selector_all("a", "elements => elements.map(el => ({href: el.href, text: el.innerText}))")
                pdf_href = None
                for link in links:
                    href = link['href']
                    text = link['text']
                    if "ATTACHMENT" in href or ".pdf" in href.lower() or "download" in text.lower():
                        pdf_href = href
                        break
                
                if pdf_href:
                    print(f"  Found PDF/Attachment link on page: {pdf_href}")
                    url = pdf_href
                else:
                    url = "https://archive-ouverte.unige.ch/unige:24139/ATTACHMENT01"

        print(f"  Attempting download from: {url}")
        
        # Robust download capture handling both inline PDF loads and attachment headers
        try:
            async with page.expect_download(timeout=15000) as download_info:
                try:
                    # Trigger navigation which could be a download
                    response = await page.goto(url, timeout=15000)
                    # If page loads successfully (inline PDF), save body
                    if response and response.status == 200:
                        buffer = await response.body()
                        if b"%PDF" in buffer[:1024]:
                            with open(file_path, "wb") as f:
                                f.write(buffer)
                            print(f"  Captured inline PDF stream: {file_path}")
                            return True
                except Exception as goto_err:
                    if "Download is starting" in str(goto_err):
                        pass # Expecting download to handle it
                    else:
                        raise goto_err
            
            download = await download_info.value
            await download.save_as(file_path)
            print(f"  Download capture successful: {file_path}")
            return True
        except Exception as download_err:
            print(f"  [Download Event failed/skipped]: {download_err}")
            
        # Last resort fallback: direct navigation response capture
        print("  Running last-resort direct capture fallback...")
        response = await page.goto(url, wait_until="networkidle", timeout=15000)
        if response and response.status == 200:
            buffer = await response.body()
            if b"%PDF" in buffer[:1024]:
                with open(file_path, "wb") as f:
                    f.write(buffer)
                print(f"  Last-resort PDF stream capture successful: {file_path}")
                return True
                
        return False
    except Exception as e:
        print(f"  [Fatal Pipeline Error]: {e}")
        return False

def extract_pdf_preview(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        num_pages = len(reader.pages)
        print(f"  [PDF Info] Total Pages: {num_pages}")
        
        # Extract first page text
        first_page_text = reader.pages[0].extract_text()
        preview = first_page_text[:400].strip().replace('\n', ' ')
        print(f"  [PDF Preview] {preview[:250]}...")
        return True
    except Exception as e:
        print(f"  [Parse Error] Failed to parse PDF: {e}")
        return False

async def main():
    os.makedirs("scratch/downloads", exist_ok=True)
    
    targets = {
        "Steven J. Phillips (Sample Selection Bias)": {
            "landing_page": "https://www.whoi.edu/cms/files/Phillips_EcolApp_2009_53454.pdf",
            "file": "scratch/downloads/phillips_playwright.pdf"
        },
        "Abel Brodeur (Star Wars: The Empirics Strike Back)": {
            "landing_page": "https://www.econstor.eu/bitstream/10419/71700/1/739716212.pdf",
            "file": "scratch/downloads/brodeur_playwright.pdf"
        }
    }
    
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
        
        for label, info in targets.items():
            print(f"\n==================================================")
            print(f"Testing with Browser: {label}")
            print(f"==================================================")
            
            success = await download_with_playwright(page, info["landing_page"], info["file"])
            if success:
                print("  Parsing downloaded PDF...")
                extract_pdf_preview(info["file"])
            else:
                print("  Pipeline failed for this paper.")
                
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
