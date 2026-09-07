from pypdf import PdfReader

def extract_to_txt():
    print("Opening PDF...")
    try:
        reader = PdfReader("GuruhariDarshan_Formatted.pdf")
        text = ""
        
        for page in reader.pages:
            text += page.extract_text() + "\n"
            
        with open("guruhari_raw.txt", "w", encoding="utf-8") as f:
            f.write(text)
            
        print("✅ Success! Extracted all text to 'guruhari_raw.txt'")
    except Exception as e:
        print(f"❌ Failed to extract PDF: {e}")

if __name__ == "__main__":
    extract_to_txt()