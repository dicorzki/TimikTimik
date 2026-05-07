import requests
from bs4 import BeautifulSoup
import json

# Fungsi buat nerjemahin "1-3 Mei 2026" jadi "2026-05-01"
def konversi_tanggal(tanggal_raw):
    bulan_map = {
        "januari": "01", "jan": "01", "februari": "02", "feb": "02",
        "maret": "03", "mar": "03", "april": "04", "apr": "04",
        "mei": "05", "juni": "06", "jun": "06", "juli": "07", "jul": "07",
        "agustus": "08", "agu": "08", "september": "09", "sep": "09",
        "oktober": "10", "okt": "10", "november": "11", "nov": "11",
        "desember": "12", "des": "12"
    }
    
    try:
        # Ubah ke huruf kecil & ganti strip jadi spasi (biar "1-3" terpisah)
        teks = tanggal_raw.lower().replace("-", " ").split()
        
        hari = "01"
        bulan = "01"
        tahun = "2026" # Default tahun
        
        for kata in teks:
            # Kalau isinya murni angka
            if kata.isdigit():
                if len(kata) == 4:
                    tahun = kata
                elif len(kata) <= 2 and hari == "01": # Ambil angka pertama sebagai hari
                    hari = kata.zfill(2)
            # Kalau isinya nama bulan
            elif kata in bulan_map:
                bulan = bulan_map[kata]
                
        return f"{tahun}-{bulan}-{hari}"
    except:
        return "2026-01-01" # Tanggal darurat kalau gagal baca

def scrape_jadwallari():
    print("Nyedot data dari jadwallari.id...")
    url = "https://jadwallari.id/events" 
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    
    provinsi_map = {
        "Jawa Timur": ["jatim", "surabaya", "malang", "batu", "sidoarjo", "kediri", "blitar", "pasuruan", "banyuwangi"],
        "Jawa Tengah": ["jateng", "semarang", "solo", "surakarta", "magelang", "boyolali", "kudus", "purwokerto", "kebumen"],
        "DI Yogyakarta": ["jogja", "yogyakarta", "sleman", "bantul", "kulon progo"],
        "Jawa Barat": ["jabar", "bandung", "bogor", "bekasi", "depok", "subang", "cianjur", "tasikmalaya"],
        "DKI Jakarta": ["jakarta", "bintaro"],
        "Bali": ["bali", "denpasar", "gianyar", "sanur", "tabanan", "buleleng"],
        "NTB": ["ntb", "lombok", "mandalika", "sembalun"],
        "Banten": ["banten", "tangerang", "serpong", "karawaci"]
    }

    try:
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        hasil = []
        
        # 1. Cek apakah tabel ketemu
        rows = soup.find_all('tr')
        print(f"Total baris tabel ditemukan: {len(rows)}") # Log tambahan
        
        for idx, row in enumerate(rows):
            if row.find('th'): continue
            
            cols = row.find_all('td')
            
            # 2. Cek jumlah kolom tiap baris
            if len(cols) >= 5:
                tanggal_raw = cols[0].text.strip()
                tanggal_format = konversi_tanggal(tanggal_raw)
                nama_event = cols[1].text.strip()
                lokasi_raw = cols[4].text.strip()
                
                provinsi_detected = "Lainnya"
                lokasi_lc = lokasi_raw.lower()
                for prov, keys in provinsi_map.items():
                    if any(key in lokasi_lc for key in keys):
                        provinsi_detected = prov
                        break
                
                # Cek apakah ada link pendaftaran
                link_tag = cols[1].find('a')
                register_url = link_tag['href'] if link_tag else "#"
                
                race = {
                    "id": f"jl_{idx}",
                    "name": nama_event,
                    "date": tanggal_format,
                    "city": lokasi_raw, 
                    "province": provinsi_detected,
                    "distances": [k.strip() for k in cols[2].text.strip().split(',') if k.strip()],
                    "runType": "TRAIL" if "TRAIL" in cols[3].text.strip().upper() else "ROAD",
                    "regType": "FCFS",
                    "status": "UPCOMING",
                    "registerUrl": register_url
                }
                hasil.append(race)
            else:
                # Log kalau ada baris yang kolomnya kurang dari 5 (biar tau kenapa diskip)
                if len(cols) > 0:
                    print(f"Baris {idx} di-skip karena cuma punya {len(cols)} kolom")

        # 3. Print hasil akhir sebelum return
        print(f"Berhasil ekstrak {len(hasil)} event dari jadwallari.id! 🚀")
        return hasil

    except Exception as e:
        print(f"Error pas nyedot: {e}")
        return []

if __name__ == "__main__":
    data = scrape_jadwallari()
    with open('races_data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)