import os
import urllib.request
from pypdf import PdfReader

# The two target PDFs verified to be publicly downloadable without institutional access
target_pdfs = {
    "Steven J. Phillips (Sample Selection Bias)": "https://archive-ouverte.unige.ch/unige:17849/ATTACHMENT01",
    "Abel Brodeur (Star Wars: The Empirics Strike Back)": "https://www.econstor.eu/bitstream/10419/71700/1/739716212.pdf"
}

def download_pdf(url, output_path):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        print(f"  Downloading from {url}...")
        with urllib.request.urlopen(req, timeout=30) as response:
            with open(output_path, 'wb') as f:
                f.write(response.read())
        return True
    except Exception as e:
        print(f"  [Download Error] Failed to download: {e}")
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

def run_test():
    os.makedirs("scratch/downloads", exist_ok=True)
    
    for label, url in target_pdfs.items():
        print(f"\n==================================================")
        print(f"Testing: {label}")
        print(f"==================================================")
        
        pdf_filename = f"scratch/downloads/{label.split(' ')[0].lower()}_target_test.pdf"
        
        success = download_pdf(url, pdf_filename)
        if success:
            print("  Download successful. Parsing PDF...")
            extract_pdf_preview(pdf_filename)
        else:
            print("  Skipping parse due to download failure.")

if __name__ == '__main__':
    run_test()
