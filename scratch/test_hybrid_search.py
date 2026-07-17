import sys
import json
import urllib.request
import urllib.parse
import re
from bs4 import BeautifulSoup

def search_scholar_title(query):
    # 1. Search Google Scholar to find the top title
    url = f"https://scholar.google.com/scholar?hl=en&q={urllib.parse.quote(query)}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read()
    except Exception as e:
        print(f"Google Scholar search error: {e}", file=sys.stderr)
        return None
        
    soup = BeautifulSoup(html, 'html.parser')
    first_result = soup.find('div', class_='gs_r gs_or gs_scl')
    if not first_result:
        return None
        
    title_el = first_result.find('h3', class_='gs_rt')
    if not title_el:
        return None
        
    a_tag = title_el.find('a')
    title = a_tag.text if a_tag else title_el.text
    title = re.sub(r'^\[[A-Z]+\]\s*', '', title).strip()
    
    paper_url = a_tag['href'] if a_tag else None
    
    # Extract year if possible
    meta_el = first_result.find('div', class_='gs_a')
    meta_text = meta_el.text if meta_el else ""
    year = None
    if meta_text:
        year_match = re.search(r'\b(19\d{2}|20\d{2})\b', meta_text)
        if year_match:
            year = int(year_match.group(1))

    return {
        'title': title,
        'url': paper_url,
        'year': year
    }

def get_semantic_scholar_details(title, api_key):
    # 2. Query Semantic Scholar with the exact title to get full structured metadata
    clean_title = urllib.parse.quote(title)
    url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={clean_title}&limit=1&fields=paperId,title,authors,year,venue,citationCount,url,openAccessPdf,externalIds,abstract"
    
    headers = {}
    if api_key:
        headers['x-api-key'] = api_key
        
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read())
            if data.get('data'):
                return data['data'][0]
    except Exception as e:
        print(f"Semantic Scholar lookup error: {e}", file=sys.stderr)
    return None

if __name__ == '__main__':
    api_key = "s2k-9rovFup6ipOeCOXLDXMqMH6GAYHJk2FFHpsrbi6Z" # From .env
    query = "convolutional neural network image classification AlexNet Krizhevsky 2012"
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        
    # Search
    found = search_scholar_title(query)
    if found:
        print("--- Google Scholar Discovery ---")
        print(f"Found Title: {found['title']}")
        print(f"Found URL:   {found['url']}")
        print(f"Found Year:  {found['year']}")
        
        # Enrich
        enriched = get_semantic_scholar_details(found['title'], api_key)
        if enriched:
            print("\n--- Semantic Scholar Enrichment ---")
            print(f"Title:       {enriched.get('title')}")
            print(f"Authors:     {', '.join([a['name'] for a in enriched.get('authors', [])])}")
            print(f"Year:        {enriched.get('year')}")
            print(f"Venue/Journ: {enriched.get('venue')}")
            print(f"Citations:   {enriched.get('citationCount')}")
            print(f"Abstract:    {enriched.get('abstract', '')[:150]}...")
            print(f"Paper URL:   {enriched.get('url')}")
    else:
        print("No papers discovered.")
