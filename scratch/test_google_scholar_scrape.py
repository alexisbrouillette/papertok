import urllib.request
import urllib.parse
import json
import re
import sys
from bs4 import BeautifulSoup

def search_google_scholar(query):
    print(f"Searching Google Scholar for: {query}", file=sys.stderr)
    
    # Format query and headers to look like a standard browser request
    url = f"https://scholar.google.com/scholar?hl=en&q={urllib.parse.quote(query)}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
    }
    
    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read()
    except Exception as e:
        print(f"Error fetching Google Scholar: {e}", file=sys.stderr)
        return []
        
    soup = BeautifulSoup(html, 'html.parser')
    results = []
    
    for div in soup.find_all('div', class_='gs_r gs_or gs_scl'):
        # 1. Title & URL
        title_el = div.find('h3', class_='gs_rt')
        if not title_el:
            continue
        
        a_tag = title_el.find('a')
        title = a_tag.text if a_tag else title_el.text
        url = a_tag['href'] if a_tag else None
        
        # Strip prefixes like [PDF], [HTML], etc.
        title = re.sub(r'^\[[A-Z]+\]\s*', '', title)
        
        # 2. Authors, Journal, Year
        meta_el = div.find('div', class_='gs_a')
        meta_text = meta_el.text if meta_el else ""
        
        # Parse meta: e.g., "A Krizhevsky, I Sutskever... - Communications of the ACM, 2012 - dl.acm.org"
        authors = ""
        venue = ""
        year = None
        
        if meta_text:
            parts = [p.strip() for p in meta_text.split(' - ')]
            if len(parts) >= 1:
                authors = parts[0]
            if len(parts) >= 2:
                venue_part = parts[1]
                # Extract year (4 digits)
                year_match = re.search(r'\b(19\d{2}|20\d{2})\b', venue_part)
                if year_match:
                    year = int(year_match.group(1))
                    # Remove year and trailing comma/spaces from venue
                    venue = re.sub(r',\s*\b(19\d{2}|20\d{2})\b', '', venue_part).strip()
                else:
                    venue = venue_part
        
        # 3. Citation count
        citations = 0
        fl_el = div.find('div', class_='gs_fl')
        if fl_el:
            for link in fl_el.find_all('a'):
                if 'Cited by' in link.text:
                    cit_match = re.search(r'Cited by\s+(\d+)', link.text)
                    if cit_match:
                        citations = int(cit_match.group(1))
                        break
                        
        results.append({
            'title': title,
            'url': url,
            'authors': authors,
            'venue': venue,
            'year': year,
            'citationCount': citations
        })
        
    return results

if __name__ == '__main__':
    query = "convolutional neural network image classification AlexNet Krizhevsky 2012"
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
    results = search_google_scholar(query)
    print(json.dumps(results, indent=2))
