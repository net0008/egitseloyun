export const DEFAULT_MISSIONS = [
  null,
  {
    title: "Bergama İzohips Haritası (200m)",
    question: "Konum ikonu ile gösterilen yerin yükseltisini bul.",
    answers: "600",
    hints: "Deniz seviyesi (kıyı çizgisi) her yerde 0 metredir.\nDeniz kıyı çizgisi ile ilk izohips arasındaki fark eküidistans değeridir.\nYükselti farkı 200m. Hesaplama: (İzohips Sayısı x 200)",
    image: "https://umap.openstreetmap.fr/tr/map/bergama-izohips-haritas-10_1372636?scaleControl=false&miniMap=false&scrollWheelZoom=true&zoomControl=false&editMode=disabled&moreControl=false&searchControl=false&tilelayersControl=null&embedControl=null&datalayersControl=true&onLoadPanel=none&captionBar=false&captionMenus=false&homeControl=false&fullscreenControl=false&captionControl=false#11/39.187296/27.199402",
    requireAll: false
  },
  {
    title: "Bergama İzohips Haritası (100m)",
    question: "Kalın çizgili bölgedeki yer şeklinin adı nedir?",
    answers: "vadi",
    hints: "İzohipslerin yükseltinin arttığı yöne büklüm yapar.\nUcu yüksek tarafa bakan 'V' şekillerine odaklanın.\nAkarsuyun yatağını oluşturan bu yer şeklinin adı nedir?",
    image: "https://umap.openstreetmap.fr/tr/map/bergama-izohips-haritas-20-vadi_1373132?scaleControl=false&miniMap=false&scrollWheelZoom=true&zoomControl=false&editMode=disabled&moreControl=false&searchControl=null&tilelayersControl=null&embedControl=null&datalayersControl=true&onLoadPanel=none&captionBar=false&captionMenus=true&fullscreenControl=false&captionControl=false#11/39.188360/27.193909",
    requireAll: false
  },
  {
    title: "Bergama İzohips Haritası (100m)",
    question: "İzohipslerin sıklaştığı yerin ortak özelliğini nedir?",
    answers: "eğim",
    hints: "İzohips eğrilerinin birbirine çok yaklaştığı bölgeleri inceleyin.\nBu bölgede akarsu olsaydı akış hızı ve aşındırma gücü yüksek olurdu.\nEğrilerin sıklaşması yükseltinin kısa mesafede değiştiği anlamına gelir.",
    image: "https://umap.openstreetmap.fr/tr/map/bergama-izohips-haritas-30-egim_1373157?scaleControl=false&miniMap=false&scrollWheelZoom=true&zoomControl=false&editMode=disabled&moreControl=false&searchControl=null&tilelayersControl=null&embedControl=null&datalayersControl=true&onLoadPanel=none&captionBar=false&captionMenus=false&homeControl=false&fullscreenControl=false&captionControl=false#11/39.187296/27.196655",
    requireAll: false
  },
  {
    title: "Bergama İzohips Haritası (100m)",
    question: "X ve Y noktalarının gerçek yükseltisini hesapla",
    answers: "100",
    hints: "Akarsuyun her iki yanındaki ilk izohipslerin yükseltisi ortaktır.\nBirbirini çevrelemeyen komşu izohipslerin yükseltileri eşittir.\nKıyıdan (0m) itibaren basamakları tek tek sayarak ilerle.",
    image: "https://umap.openstreetmap.fr/tr/map/bergama-izohips-haritas-40-xy_1373168?scaleControl=false&miniMap=false&scrollWheelZoom=true&zoomControl=false&editMode=disabled&moreControl=false&searchControl=null&tilelayersControl=null&embedControl=false&datalayersControl=true&onLoadPanel=none&captionBar=false&captionMenus=false&homeControl=false&fullscreenControl=false&captionControl=false#11/39.179312/27.183609",
    requireAll: false
  },
  {
    title: "Bergama İzohips Haritası (100m)",
    question: "Sarı daireli yerlere ne denir?",
    answers: "tepe,zirve,doruk",
    hints: "İzohipslerin oluşturduğu en içteki kapalı halkalara odaklanın.\nÇevresine göre daha yüksekte kalan tepe ve zirve noktalarını temsil ederler.",
    image: "https://umap.openstreetmap.fr/tr/map/bergama-izohips-haritas-50-tep_1373177?scaleControl=false&miniMap=false&scrollWheelZoom=true&zoomControl=false&editMode=disabled&moreControl=false&searchControl=false&tilelayersControl=null&embedControl=false&datalayersControl=true&onLoadPanel=none&captionBar=false&captionMenus=false&homeControl=false&fullscreenControl=false&captionControl=false#11/39.190489/27.191162",
    requireAll: false
  },
  {
    title: "Bergama İzohips Haritası (200m)",
    question: "Kırmızı daire içine alınan yere ne ad verilir?",
    answers: "sırt",
    hints: "İzohips eğrilerinin, yükseltinin azaldığı (alçaldığı) yöne doğru yaptığı büklümlere odaklan.\nUcu dışarı doğru, yani rakamı küçük olan izohipse doğru bakan 'V' şekillerini takip et.\nBilgisayar başında çok fazla oturduğun zaman omurganın en çok neresi ağrır? İşte bu yer şeklinin adı da tam olarak odur!",
    image: "https://umap.openstreetmap.fr/tr/map/bergama-izohips-haritas-60-srt_1373266?scaleControl=false&miniMap=false&scrollWheelZoom=true&zoomControl=false&editMode=disabled&moreControl=false&searchControl=null&tilelayersControl=null&embedControl=null&datalayersControl=true&onLoadPanel=none&captionBar=false&captionMenus=false&homeControl=false&fullscreenControl=false&captionControl=false",
    requireAll: false
  },
  {
    title: "Bergama İzohips Haritası (200m)",
    question: "Z ve Y alanlarının morfolojik adlarını yaz. (Yazım sırası Z, Y)",
    answers: "plato,ova",
    hints: "Akarsularla derince yarılmış yüksek düzlüklere plato denir.\nÇevresine göre alçakta kalan geniş düzlük alanlara ova denir.\nZ (Yüksek) ve Y (Alçak) düzlük kavramlarını birleştirin.",
    image: "https://umap.openstreetmap.fr/tr/map/bergama-izohips-haritas-70-platoova_1373269?scaleControl=false&miniMap=false&scrollWheelZoom=true&zoomControl=false&editMode=disabled&moreControl=false&searchControl=null&tilelayersControl=null&embedControl=null&datalayersControl=true&onLoadPanel=none&captionBar=false&captionMenus=false&fullscreenControl=false&captionControl=false&homeControl=false#11/39.185167/27.224808",
    requireAll: true
  },
  {
    title: "Demre (Antalya) İzohips Haritası (100m)",
    question: "A ve B kıyı yer şeklinin adı nedir? (Yazım sırası: A, B)",
    answers: "delta,falez",
    hints: "Akarsu alüvyonlarının denize döküldüğü yerde birikmesiyle oluşur.\nDeniz kıyısındaki çizgilerin sıklaşması uçurumları (falez) gösterir.\nDelta ve Falez kavramlarını uygun noktalarla eşleştirin.",
    image: "https://umap.openstreetmap.fr/tr/map/bergama-izohips-haritas-80-platoova_1373273?scaleControl=false&miniMap=false&scrollWheelZoom=true&zoomControl=false&editMode=disabled&moreControl=false&searchControl=null&tilelayersControl=null&embedControl=null&datalayersControl=true&onLoadPanel=none&captionBar=false&captionMenus=false&homeControl=false&fullscreenControl=false&captionControl=false#12/36.304750/30.022888",
    requireAll: true
  },
  {
    title: "Bergama İzohips Haritası (100m)",
    question: "V, Y ve Z oklarını eğim miktarına göre matematiksel kurala göre sıralayın. Örnek: Z > Y > V gibi.",
    answers: "z>y>v,y>z>v",
    hints: "Çizgilerin en sık olduğu doğrultuda eğim en yüksek seviyededir.\nÇizgilerin seyrek olduğu doğrultu eğimin en az olduğu yerdir.\nV, Y ve Z oklarını bu matematiksel kurala göre sıralayın.",
    image: "https://umap.openstreetmap.fr/tr/map/kopya-bergama-izohips-haritas-90-yzv_1373283?scaleControl=false&miniMap=false&scrollWheelZoom=true&zoomControl=false&editMode=disabled&moreControl=false&searchControl=null&tilelayersControl=null&embedControl=null&datalayersControl=true&onLoadPanel=none&captionBar=false&captionMenus=false&homeControl=false&fullscreenControl=false&captionControl=false#11/39.186764/27.195969",
    requireAll: false
  },
  {
    title: "GÖREV 10: DİKİLİ - AKHİSAR PROFİL HATTI",
    question: "OpenTopoMap fiziki haritasında parlayan Dikili (Kıyı - 0m) ve Akhisar (Ova - 95m) hedeflerine dokunarak topoğrafik profil lazer hattını oluşturunuz.",
    answers: "profil,tamam",
    hints: "1. Adım: Haritada Dikili kıyı şeridini (0 m - Ege Denizi) seçin.\n2. Adım: Manisa Akhisar çöküntü ovasını (95 m) seçin.\nİki nokta arasındaki lazer hattı arazi kesitini otomatik çıkaracaktır.",
    image: "https://tile.opentopomap.org",
    requireAll: false
  },
  {
    title: "GÖREV 11: KRİTİK FİNAL - PROFİL TESPİTİ",
    question: "Dikili-Akhisar (A-B) topoğrafik kesit hattına ait doğru arazi profilini (A, B, C veya D) tespit ediniz.",
    answers: "a",
    hints: "Dikili deniz kıyısında yer aldığı için kesit 0 metreden başlamalıdır.\nArazi doğuya doğru Yunt Dağları kütlesini aşarak yaklaşık 680 metreye kadar yükselir.\nArdından Akhisar çöküntü ovasına inilerek profil yaklaşık 95-100 metrede sonlanır.",
    image: "https://tile.opentopomap.org",
    requireAll: false
  }
];
