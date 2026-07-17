import sys
import json
import asyncio
import re
import urllib.parse
from playwright.async_api import async_playwright

async def search_google_scholar_fallback(title):
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
        
        # Search on standard Google.com
        search_url = f"https://www.google.com/search?q={urllib.parse.quote(title)}"
        await page.goto(search_url, wait_until="domcontentloaded", timeout=25000)
        await page.wait_for_timeout(1500)
        
        # 1. Extract citation count from the entire body text
        body_text = await page.eval_on_selector("body", "el => el.innerText")
        cite_re = re.compile(r'(?:cited\s+by|cité\s+par|citado\s+por|citato\s+da)\s+([\d,]+|\d+)', re.IGNORECASE)
        citations = 0
        matches = cite_re.findall(body_text)
        if matches:
            citations = int(matches[0].replace(",", ""))
            
        # 2. Extract organic links and details
        # Let's extract search result links (typically within h3 tags inside organic results)
        results = await page.eval_on_selector_all("div.g", """elements => {
            return elements.map(el => {
                const a = el.querySelector('a');
                const h3 = el.querySelector('h3');
                const snippet = el.querySelector('div[style*="webkit-line-clamp"]');
                return {
                    title: h3 ? h3.innerText : '',
                    url: a ? a.href : '',
                    snippet: snippet ? snippet.innerText : ''
                };
            });
        }""")
        
        await browser.close()
        
        # Clean URLs and find the best match
        clean_results = []
        for r in results:
            url = r.get('url', '')
            if not url or not url.startswith("http"):
                continue
            url_lower = url.lower()
            if "google.com" in url_lower or "googleusercontent.com" in url_lower or "youtube.com" in url_lower:
                continue
                
            # Guess venue from URL
            venue = "Academic Journal"
            if "arxiv.org" in url_lower:
                venue = "arXiv Preprint"
            elif "nature.com" in url_lower:
                venue = "Nature"
            elif "springer.com" in url_lower:
                venue = "Springer"
            elif "ieee.org" in url_lower:
                venue = "IEEE"
            elif "sciencedirect.com" in url_lower:
                venue = "ScienceDirect"
            elif "researchgate.net" in url_lower:
                venue = "ResearchGate"
                
            clean_results.append({
                'title': r.get('title') or title,
                'url': url,
                'authors': "Unknown Authors",
                'venue': venue,
                'year': None,
                'citationCount': citations,
                'abstract': r.get('snippet', '')
            })
            
        if not clean_results:
            # Fallback if no organic links found (e.g. captcha)
            clean_results.append({
                'title': title,
                'url': f"https://scholar.google.com/scholar?q={urllib.parse.quote(title)}",
                'authors': "Unknown Authors",
                'venue': "Google Scholar",
                'year': None,
                'citationCount': citations,
                'abstract': ""
            })
            
        return clean_results[:1]

if __name__ == '__main__':
    query = "ImageNet Classification with Deep Convolutional Neural Networks"
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
    try:
        results = asyncio.run(search_google_scholar_fallback(query))
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps([]))
