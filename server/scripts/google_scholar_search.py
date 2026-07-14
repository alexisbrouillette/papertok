import urllib.request
import urllib.parse
import json
import re
import sys
from bs4 import BeautifulSoup

def parse_scholar_search(query):
    # Format query and headers to look like a standard browser request
    url = f"https://scholar.google.com/scholar?hl=en&q={urllib.parse.quote(query)}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5,fr;q=0.3'
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
        
        # Strip prefixes like [PDF], [HTML], [CITATION], etc.
        title = re.sub(r'^\[[A-Z\s]+\]\s*', '', title).strip()
        
        # 2. Authors, Journal/Venue, and Year from the gs_a div
        meta_el = div.find('div', class_='gs_a')
        meta_text = meta_el.text if meta_el else ""
        
        authors = ""
        venue = ""
        year = None
        
        if meta_text:
            # Find year anywhere in meta_text
            year_match = re.search(r'\b(19\d{2}|20\d{2})\b', meta_text)
            if year_match:
                year = int(year_match.group(1))
            
            parts = [p.strip() for p in meta_text.split(' - ')]
            if len(parts) >= 1:
                authors = parts[0]
            
            venue_parts = parts[1:]
            clean_venue_parts = []
            for vp in venue_parts:
                # Remove the year from this part
                vp_clean = re.sub(r'\b(19\d{2}|20\d{2})\b', '', vp)
                # Clean up punctuation like leading/trailing commas, hyphens, and whitespace
                vp_clean = re.sub(r'^[,;\-\s]+|[,;\-\s]+$', '', vp_clean).strip()
                if vp_clean:
                    clean_venue_parts.append(vp_clean)
            
            if clean_venue_parts:
                venue = " - ".join(clean_venue_parts)
            else:
                venue = "Academic Journal"
                    
        # 3. Citations Count (Scan all gs_fl classes since there can be multiple)
        citations = 0
        for fl_el in div.find_all('div', class_='gs_fl'):
            for link in fl_el.find_all('a'):
                text = link.text.lower()
                # Match "Cited by X", "Cité par X", "Citado por X"
                if 'cited by' in text or 'cité par' in text or 'citado por' in text:
                    cit_match = re.search(r'(?:by|par|por)\s+([\d,]+)', text)
                    if cit_match:
                        citations = int(cit_match.group(1).replace(',', ''))
                        break
            if citations > 0:
                break
                        
        # 4. Snippet / Abstract Description
        snippet_el = div.find('div', class_='gs_rs')
        snippet = snippet_el.text if snippet_el else ""
        
        results.append({
            'title': title,
            'url': url,
            'authors': authors,
            'venue': venue,
            'year': year,
            'citationCount': citations,
            'abstract': snippet
        })
        
    return results

if __name__ == '__main__':
    query = "ImageNet Classification with Deep Convolutional Neural Networks"
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
    results = parse_scholar_search(query)
    print(json.dumps(results, indent=2))
