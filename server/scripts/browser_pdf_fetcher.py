import asyncio
import os
import sys
import argparse
import json
import urllib.parse
import urllib.request
from playwright.async_api import async_playwright
from pypdf import PdfReader

# Temporary directory for downloads
TEMP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "temp_downloads")

async def download_pdf_stream(page, url, file_path):
    # Determine if direct link or landing page
    is_direct_pdf = url.lower().endswith(".pdf") or "attachment" in url.lower() or "/bitstream/" in url.lower()
    
    if not is_direct_pdf:
        # Navigate to landing page first
        response = await page.goto(url, wait_until="domcontentloaded", timeout=25000)
        
        # If it happens to render inline directly on navigation
        if response and response.status == 200:
            content_type = response.headers.get("content-type", "").lower()
            if "application/pdf" in content_type:
                buffer = await response.body()
                if b"%PDF" in buffer[:1024]:
                    with open(file_path, "wb") as f:
                        f.write(buffer)
                    return True

    # Try downloading
    try:
        async with page.expect_download(timeout=15000) as download_info:
            try:
                response = await page.goto(url, timeout=15000)
                if response and response.status == 200:
                    buffer = await response.body()
                    if b"%PDF" in buffer[:1024]:
                        with open(file_path, "wb") as f:
                            f.write(buffer)
                        return True
            except Exception as goto_err:
                if "Download is starting" in str(goto_err):
                    pass
                else:
                    raise goto_err
        
        download = await download_info.value
        await download.save_as(file_path)
        return True
    except Exception:
        # Fallback to direct navigation and body capture
        try:
            response = await page.goto(url, wait_until="networkidle", timeout=15000)
            if response and response.status == 200:
                buffer = await response.body()
                if b"%PDF" in buffer[:1024]:
                    with open(file_path, "wb") as f:
                        f.write(buffer)
                    return True
        except Exception:
            pass
    return False

async def search_google_scholar(page, query):
    search_url = f"https://scholar.google.com/scholar?q={urllib.parse.quote(query)}"
    await page.goto(search_url, wait_until="domcontentloaded", timeout=25000)
    await page.wait_for_timeout(1000)
    
    # Look for PDF links in search results (typically right-hand column links with text containing [PDF])
    links = await page.eval_on_selector_all("a", """elements => 
        elements.map(el => ({
            href: el.href,
            text: el.innerText.trim(),
            parentText: el.parentElement ? el.parentElement.innerText : ""
        }))
    """)
    
    pdf_hrefs = []
    # 1. Search for explicit [PDF] sidebar links first
    for link in links:
        href = link['href']
        text = link['text']
        parent = link['parentText']
        if "[PDF]" in text or "[PDF]" in parent:
            if href.lower().startswith("http") and href not in pdf_hrefs:
                pdf_hrefs.append(href)
                
    # 2. Fallback to any direct link matching .pdf in standard results
    for link in links:
        href = link['href']
        if href.lower().endswith(".pdf") or "/bitstream/" in href.lower():
            if href.lower().startswith("http") and href not in pdf_hrefs:
                pdf_hrefs.append(href)
                
    return pdf_hrefs

async def search_google_standard(page, query):
    # Search standard Google with filetype:pdf suffix
    search_url = f"https://www.google.com/search?q={urllib.parse.quote(query + ' filetype:pdf')}"
    await page.goto(search_url, wait_until="domcontentloaded", timeout=25000)
    await page.wait_for_timeout(1000)
    
    links = await page.eval_on_selector_all("a", """elements => 
        elements.map(el => ({
            href: el.href,
            text: el.innerText.trim()
        }))
    """)
    
    pdf_hrefs = []
    for link in links:
        href = link['href']
        if href.lower().startswith("http"):
            # Exclude Google internal urls
            if "google.com" in href.lower() or "googleusercontent.com" in href.lower():
                continue
            if href.lower().endswith(".pdf") or "pdf" in href.lower() or "/bitstream/" in href.lower():
                if href not in pdf_hrefs:
                    pdf_hrefs.append(href)
    return pdf_hrefs

def extract_pdf_content(file_path):
    try:
        reader = PdfReader(file_path)
        num_pages = len(reader.pages)
        
        # Extract first 4 pages and last 2 pages to preserve memory/token limits
        pages_to_extract = list(range(min(4, num_pages)))
        if num_pages > 4:
            pages_to_extract.extend(range(max(4, num_pages - 2), num_pages))
            
        # Deduplicate pages just in case
        pages_to_extract = sorted(list(set(pages_to_extract)))
        
        extracted_text = []
        for p_idx in pages_to_extract:
            page_text = reader.pages[p_idx].extract_text()
            if page_text:
                extracted_text.append(f"--- PAGE {p_idx + 1} ---\n{page_text.strip()}")
                
        full_text = "\n\n".join(extracted_text)
        return {
            "success": True,
            "total_pages": num_pages,
            "text": full_text[:15000] # Cap text safety boundary
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"PDF parse failed: {str(e)}"
        }

async def run(args):
    os.makedirs(TEMP_DIR, exist_ok=True)
    temp_pdf_path = os.path.join(TEMP_DIR, f"temp_{os.getpid()}.pdf")
    
    resolved_url = None
    success = False
    tried_urls = set()

    async def try_download_and_verify(url, page=None):
        if not url or url in tried_urls:
            return False
        tried_urls.add(url)
        
        # A. Try fast direct HTTP download via urllib first
        try:
            req = urllib.request.Request(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    buffer = response.read()
                    if b"%PDF" in buffer[:1024]:
                        with open(temp_pdf_path, "wb") as f:
                            f.write(buffer)
                        verify = extract_pdf_content(temp_pdf_path)
                        if verify["success"]:
                            return True
        except Exception:
            pass

        # B. Fallback to Playwright if page browser context is active
        if page:
            try:
                if await download_pdf_stream(page, url, temp_pdf_path):
                    verify = extract_pdf_content(temp_pdf_path)
                    if verify["success"]:
                        return True
            except Exception:
                pass
        return False

    # 1. Try primary URL via urllib first (super fast, no browser boot time)
    if args.url:
        if await try_download_and_verify(args.url):
            success = True
            resolved_url = args.url

    # 2. If primary failed or not provided, launch Playwright to search Google Scholar & retry candidates
    if not success:
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
            
            # If primary URL failed, try it again using Playwright browser download sequence
            if args.url and args.url not in tried_urls:
                if await try_download_and_verify(args.url, page):
                    success = True
                    resolved_url = args.url

            # Search Google Scholar or standard Google for alternatives if we still have no PDF
            if not success and args.query:
                search_candidates = []
                try:
                    search_candidates = await search_google_scholar(page, args.query)
                except Exception as e:
                    sys.stderr.write(f"[Google Scholar Search Failed] {str(e)}\n")

                # If Scholar was blocked or returned no PDF links, fall back to standard Google Search with filetype:pdf
                if not search_candidates:
                    sys.stderr.write("[Google Scholar returned no candidates, trying standard Google Search...]\n")
                    try:
                        search_candidates = await search_google_standard(page, args.query)
                    except Exception as e:
                        sys.stderr.write(f"[Google Standard Search Failed] {str(e)}\n")

                # Try search result PDF candidates one by one
                for url in search_candidates:
                    if await try_download_and_verify(url, page):
                        success = True
                        resolved_url = url
                        break
                        
            await browser.close()
            
    # Phase 3: Output results
    if success and os.path.exists(temp_pdf_path):
        result = extract_pdf_content(temp_pdf_path)
        try:
            os.remove(temp_pdf_path)
        except OSError:
            pass
            
        if result["success"]:
            print(json.dumps({
                "success": True,
                "pdf_url": resolved_url,
                "total_pages": result["total_pages"],
                "text": result["text"]
            }))
        else:
            print(json.dumps({"success": False, "error": result["error"]}))
    else:
        print(json.dumps({"success": False, "error": "Failed to download and verify any PDF candidates."}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="PaperTok Stealth PDF Fetcher and Text Parser")
    parser.add_argument("--url", help="Direct URL to download PDF")
    parser.add_argument("--query", help="Google Scholar search query for fallback resolution")
    
    args = parser.parse_args()
    if not args.url and not args.query:
        print(json.dumps({"success": False, "error": "Either --url or --query must be provided."}))
        sys.exit(1)
        
    asyncio.run(run(args))
