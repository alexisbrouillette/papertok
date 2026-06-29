import urllib.request
import urllib.parse
import re
import sys

def get_citations(title):
    query = f'"{title}" "cited by"'
    url = 'https://html.duckduckgo.com/html/?q=' + urllib.parse.quote(query)
    
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
            with open("scratch/ddg_result.html", "w") as f:
                f.write(html)
            
            # Print search result snippets (usually in class "result__snippet")
            snippets = re.findall(r'<a class="result__snippet"[^>]*>(.*?)</a>', html, re.DOTALL)
            print(f"Found {len(snippets)} snippets.")
            for i, snip in enumerate(snippets[:3]):
                # Remove HTML tags
                clean_snip = re.sub(r'<[^>]+>', '', snip)
                print(f"  Snippet {i+1}: {clean_snip}")

            matches = re.findall(r'(?:Cited by|Cité par|Zitiert von|Citato da|Citado por)\s*(\d+)', html, re.IGNORECASE)
            print("Direct citations regex matches:", matches)
            if matches:
                counts = [int(m) for m in matches]
                return max(counts)
            else:
                any_matches = re.findall(r'(?:cited by|cité par)\s*(\d+)', html, re.IGNORECASE)
                print("Fallback citations regex matches:", any_matches)
                if any_matches:
                    return max([int(m) for m in any_matches])
    except Exception as e:
        print(f"Error querying DDG: {e}", file=sys.stderr)
    return None

if __name__ == "__main__":
    title = "Attention Is All You Need"
    if len(sys.argv) > 1:
        title = sys.argv[1]
    
    print(f"Searching citations for: {title}")
    count = get_citations(title)
    print(f"Citations count: {count}")
