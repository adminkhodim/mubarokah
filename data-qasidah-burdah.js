/**
 * Data Qasidah Burdah (قصيدة البردة للإمام البوصيري)
 * Disusun lengkap 10 Fasal dengan Teks Arab berharakat, Transliterasi Latin, dan Terjemahan Bahasa Indonesia
 * Diadopsi sesuai khazanah dan standar Quran NU Online
 */

const qasidahBurdah = [
    {
        id: 1,
        title: "Bab I: Rayuan Cinta dan Pengaduan Rindu",
        arabicTitle: "الفصل الأول: في الغزل وشكوى الغرام",
        desc: "Kisah kerinduan yang mendalam kepada baginda Nabi Muhammad SAW dan tangisan air mata duka para pecinta.",
        refrain: {
            arabic: "مَوْلَايَ صَلِّ وَسَلِّمْ دَآئِــمًا أَبَـدًا ۞ عَلَى حَبِيْبِـكَ خَيْــرِ الْخَلْقِ كُلِّهِمِ",
            latin: "Maulâya shalli wa sallim dâ'iman abadan ۞ ‘alâ ḫabîbika khairil-khalqi kullihimi",
            translation: "Wahai Tuhanku, limpahkanlah selalu shalawat dan salam selamanya, atas kekasih-Mu yang terbaik di antara seluruh ciptaan."
        },
        verses: [
            {
                no: 1,
                arabic: "أَمِنْ تَذَكُّــرِ جِــــيْرَانٍ بِذِيْ سَــــلَمِ ۞ مَزَجْتَ دَمْعًا جَرَى مِنْ مُقْلَةٍ بِـــدَمِ",
                latin: "Amin tadzakkuri jîrânin bidzî salami ۞ mazajta dam‘an jarâ min muqlatin bidami",
                translation: "Apakah karena teringat para kekasih yang tinggal di Dzi Salam sana, engkau campurkan air mata yang mengalir dari pelupuk mata dengan darah duka?"
            },
            {
                no: 2,
                arabic: "أَمْ هَبَّتِ الرِّيْحُ مِنْ تِلْقَـاءِ كَاظِمَـةٍ ۞ وَأَوْمَضَ الْبَرْقُ فِيْ الْظَلْمَآءِ مِنْ إِضَـمِ",
                latin: "Am habbatir-rîḫu min tilqâ'i kâdzimatin ۞ wa aumadlal-barqu fidl-dhalmâ'i min idlami",
                translation: "Ataukah karena embusan semilir angin yang bertiup dari arah Kadhimah (Madinah), atau kilatan petir yang membelah gulita malam dari lembah Idlam?"
            },
            {
                no: 3,
                arabic: "فَمَا لِعَيْنَيْكَ إِنْ قُلْتَ اكْفُفَا هَمَتَـا ۞ وَمَا لِقَلْبِكَ إِنْ قُلْتَ اسْتَفِقْ يَهِـمِ",
                latin: "Fa mâ li'ainaika in qultakfufâ hamatâ ۞ wa mâ liqalbika in qultastafiq yahimi",
                translation: "Mengapa kedua matamu tetap saja mencucurkan air mata saat kauperintahkan menahannya? Dan mengapa hatimu tetap gundah gulana saat kauminta sadar?"
            },
            {
                no: 4,
                arabic: "أَيَحْسَبُ الصَّبُّ أَنَّ الْحُبَّ مُنْكَتِـمٌ ۞ مَا بَيْنَ مُنْسَجِمٍ مِنْهُ وَمُضْطَـرِمِ",
                latin: "Ayaḫsabus-shabbu annal-ḫubba munkatimun ۞ mâ baina munsajimin minhu wa mudltharimi",
                translation: "Apakah orang yang dimabuk asmara mengira bahwa cinta dapat disembunyikan, di antara lelehan air mata yang mengalir dan kobaran hati yang membara?"
            },
            {
                no: 5,
                arabic: "لَوْلَا الْهَوَى لَمْ تُرِقْ دَمْعًا عَلَى طَلَلٍ ۞ وَلَا أَرِقْتَ لِذِكْرِ الْبَانِ وَالْعَلَـمِ",
                latin: "Laulâl-hawâ lam turiq dam‘an ‘alâ thalalin ۞ wa lâ ariqta lidzikril-bâni wal-‘alami",
                translation: "Jikalau bukan karena cinta yang tulus, niscaya engkau takkan mencucurkan air mata di atas puing-puing bekas hunian kekasih, dan engkau takkan terjaga malam mengenang pepohonan Ban dan bukit Alam."
            },
            {
                no: 6,
                arabic: "فَكَيْفَ تُنْكِرُ حُبًّا بَعْدَ مَا شَهِدَتْ ۞ بِهِ عَلَيْكَ عُدُوْلُ الدَّمْعِ وَالسَّـقَمِ",
                latin: "Fakaifa tunkiru ḫubban ba‘da mâ syahidat ۞ bihi ‘alaika ‘udûlud-dam‘i was-saqami",
                translation: "Lalu bagaimana mungkin engkau dapat memungkiri rasa cinta itu, setelah saksi-saksi adil berupa lelehan air mata dan derita sakitmu bersaksi atas dirimu?"
            },
            {
                no: 7,
                arabic: "وَأَثْبَتَ الْوَجْدُ خَطَّيْ عَبْرَةٍ وَضَنًى ۞ مِثْلَ الْبَهَارِ عَلَى خَدَّيْكَ وَالْعَنَـمِ",
                latin: "Wa ats fatal-wajdu khath-thai ‘abratin wa dlanan ۞ mitslal-bahâri ‘alâ khaddaika wal-‘anami",
                translation: "Rasa rindu yang mendalam telah menggoreskan dua garis tangisan dan kurus kering, laksana bunga kuning dan dahan merah di kedua pipimu."
            },
            {
                no: 8,
                arabic: "نَعَمْ سَرَى طَيْفُ مَنْ أَهْوَى فَأَرَّقَنِيْ ۞ وَالْحُبُّ يَعْتَرِضُ اللَّذَّاتِ بِالأَلَـمِ",
                latin: "Na‘am sarâ thaifu man ahwâ fa-arraqanî ۞ wal-ḫubbu ya‘taridlul-ladz-dzâti bil-alami",
                translation: "Benar! Bayangan sosok kekasih yang amat kukasihi hadir menyapa di waktu malam hingga membuatku tak bisa terlelap, dan cinta memang selalu merintangi kelezatan dengan kepedihan rindu."
            },
            {
                no: 9,
                arabic: "يَا لَائِمِيْ فِيْ الْهَوَى الْعُذْرِيِّ مَعْذِرَةً ۞ مِنِّيْ إِلَيْكَ وَلَوْ أَنْصَفْتَ لَمْ تَلُـمِ",
                latin: "Yâ lâ'imî fîl-hawal-‘udzriyyi ma‘dziratan ۞ minnî ilaika walau anshafta lam talumi",
                translation: "Wahai pencela cintaku yang suci murni, terimalah permohonan maafku. Andaikan engkau bersikap adil bijaksana, niscaya engkau takkan mencelaku."
            },
            {
                no: 10,
                arabic: "عَدَتْكَ حَالِيْ لَا سِرِّيْ بِمُسْتَتِرٍ ۞ عَنِ الْوُشَاةِ وَلَا دَائِيْ بِمُنْحَسِـمِ",
                latin: "‘Adatka ḫâlî lâ sirrî bimustatirin ۞ ‘anil-wusyâti wa lâ dâ'î bimunḫasimi",
                translation: "Kini keadaanku telah tampak jelas bagimu. Rasiaku tak lagi tersembunyi dari para pengadu domba, dan penyakit cintaku tak kunjung sirna."
            },
            {
                no: 11,
                arabic: "مَحَّضْتَنِيْ النُّصْحَ لَكِنْ لَسْتُ أَسْمَعُهُ ۞ إِنَّ الْمُحِبَّ عَنِ الْعُذَّالِ فِيْ صَمَـمِ",
                latin: "Maḫḫadltanin-nusḫa lâkin lastu asma‘uhu ۞ innal-muḫibba ‘anil-‘udz-dzâli fî shamami",
                translation: "Engkau telah tulus memberiku nasihat, namun aku tiada mampu mendengarnya. Sungguh, seorang pecinta itu tuli dari segala celaan para pencela."
            },
            {
                no: 12,
                arabic: "إِنِّيْ اتَّهَمْتُ نَصِيْحَ الشَّيْبِ فِيْ عَذَلِيْ ۞ وَالشَّيْبُ أَبْعَدُ فِيْ نُصْحٍ عَنِ التُّهَـمِ",
                latin: "Innît-tahamtu nashîḫasy-syaibi fî ‘adzalî ۞ wasy-syaibu ab‘adu fî nusḫin ‘anit-tuhami",
                translation: "Bahkan aku mencurigai nasihat ubanku saat menegurku, padahal sejatinya uban adalah penasihat yang paling jauh dari kecurigaan dusta."
            }
        ]
    },
    {
        id: 2,
        title: "Bab II: Peringatan tentang Bahaya Hawa Nafsu",
        arabicTitle: "الفصل الثاني: في التحذير من شهوة النفس",
        desc: "Peringatan mendalam tentang tipu daya nafsu ammarah dan ajakan untuk senantiasa menundukkannya.",
        refrain: {
            arabic: "مَوْلَايَ صَلِّ وَسَلِّمْ دَآئِــمًا أَبَـدًا ۞ عَلَى حَبِيْبِـكَ خَيْــرِ الْخَلْقِ كُلِّهِمِ",
            latin: "Maulâya shalli wa sallim dâ'iman abadan ۞ ‘alâ ḫabîbika khairil-khalqi kullihimi",
            translation: "Wahai Tuhanku, limpahkanlah selalu shalawat dan salam selamanya, atas kekasih-Mu yang terbaik di antara seluruh ciptaan."
        },
        verses: [
            {
                no: 1,
                arabic: "فَإِنَّ أَمَّارَتِيْ بِالسُّوْءِ مَا اتَّعَظَتْ ۞ مِنْ جَهْلِهَا بِنَذِيْرِ الشَّيْبِ وَالْهَـرَمِ",
                latin: "Fa-inna ammâratî bis-sû'i mat-ta‘adhat ۞ min jahlihâ binadzîrisy-syaibi wal-harami",
                translation: "Sungguh, nafsu ammarahku yang gemar berbuat cela tiada kunjung mengambil pelajaran, lantaran kebodohannya terhadap peringatan uban dan ketuaan fisik."
            },
            {
                no: 2,
                arabic: "وَلَا أَعَدَّتْ مِنَ الْفِعْلِ الْجَمِيْلِ قِرَى ۞ ضَيْفٍ أَلَمَّ بِرَأْسِيْ غَيْرَ مُحْتَشِمِ",
                latin: "Wa lâ a‘addat minal-fi‘lil-jamîli qirâ ۞ dlaifin alamma bira'sî ghaira muḫtasyimi",
                translation: "Ia tiada menyiapkan hidangan amal kebajikan sedikit pun guna menyambut tamu kehormatan (uban) yang telah singgah di kepalaku tanpa rasa canggung."
            },
            {
                no: 3,
                arabic: "لَوْ كُنْتُ أَعْلَمُ أَنِّيْ مَا أُوَقِّرُهُ ۞ كَتَمْتُ سِرًّا بَدَا لِيْ مِنْهُ بِالْكَتَمِ",
                latin: "Lau kuntu a‘lamu annî mâ uwaqqiruhu ۞ katamtu sirran badâ lî minhu bil-katami",
                translation: "Jikalau aku menyadari bahwa aku belum mampu memuliakannya, niscaya kusembunyikan rahasia uban yang tampak itu dengan pewarna semir daun katam."
            },
            {
                no: 4,
                arabic: "مَنْ لِيْ بِرَدِّ جِمَاحٍ مِنْ غَوَايَتِهَا ۞ كَمَا يُرَدُّ جِمَاحُ الْخَيْلِ بِاللُّجُـمِ",
                latin: "Man lî biraddi jimâḫin min ghawâyatihâ ۞ kamâ yuraddu jimâḫul-khaili bil-lujumi",
                translation: "Siapakah yang sanggup mengendalikan keliaran hawa nafsuku dari kesesatannya, sebagaimana liarnya kuda perang yang dikendalikan dengan tali kekang?"
            },
            {
                no: 5,
                arabic: "فَلَا تَرُمْ بِالْمَعَاصِيْ كَسْرَ شَهْوَتِهَا ۞ إِنَّ الطَّعَامَ يُقَوِّيْ شَهْوَةَ النَّهِمِ",
                latin: "Falâ tarum bil-ma‘âshî kasra syahwatihâ ۞ innath-tha‘âma yuqawwî syahwatan-nahimi",
                translation: "Maka jangan sekali-kali engkau berhasrat meredakan nafsu syahwat dengan meladeni kemaksiatan, karena makanan lezat justru kian menguatkan kerakusan orang yang tamak."
            },
            {
                no: 6,
                arabic: "وَالنَّفْسُ كَالطِّفْلِ إِنْ تُهْمِلْهُ شَبَّ عَلَى ۞ حُبِّ الرَّضَاعِ وَإِنْ تَفْطِمْهُ يَنْفَطِمِ",
                latin: "Wan-nafsu kath-thifli in tuhmilhu syabba ‘alâ ۞ ḫubbir-radlâ‘i wa in tafthimhu yanfathimi",
                translation: "Hawa nafsu itu laksana bayi mungil; bila kauabaikan ia akan terus tumbuh mencintai susu susuan ibunya, namun jika engkau menyapihnya, niscaya ia akan tersapih."
            },
            {
                no: 7,
                arabic: "فَاصْرِفْ هَوَاهَا وَحَاذِرْ أَنْ تُوَلِّيَهُ ۞ إِنَّ الْهَوَى مَا تَوَلَّى يُصْمِ أَوْ يَصِمِ",
                latin: "Fashrif hawâhâ wa ḫâdzir an tuwalliyahu ۞ innal-hawâ mâ tawallâ yushmi au yashimi",
                translation: "Maka palingkanlah hawa nafsu dan waspadalah jangan biarkan ia berkuasa, karena sesungguhnya hawa nafsu tatkala berkuasa pasti akan membinasakan atau memperdayaimu."
            },
            {
                no: 8,
                arabic: "وَرَاعِهَا وَهْيَ فِيْ الْأَعْمَالِ سَائِمَةٌ ۞ وَإِنْ هِيَ اسْتَحْلَتِ الْمَرْعَى فَلَا تُسِمِ",
                latin: "Wa râ‘ihâ wahya fîl-a‘mâli sâ'imatun ۞ wa in hiyas-taḫlatil-mar‘â falâ tusimi",
                translation: "Gembalakanlah nafsu itu tatkala ia tengah merumput dalam ladang amal kebajikan; dan jika ia merasa terlena menemukan padang rumput manis, jangan biarkan ia terlepas bebas."
            },
            {
                no: 9,
                arabic: "كَمْ حَسَّنَتْ لَذَّةً لِلْمَرْءِ قَاتِلَةً ۞ مِنْ حَيْثُ لَمْ يَدْرِ أَنَّ السُّمَّ فِيْ الدَّسَمِ",
                latin: "Kam ḫassanat ladz-dzatan lil-mar'i qâtilatan ۞ min ḫaitsu lam yadri annas-summa fid-dasami",
                translation: "Betapa kerap hawa nafsu memoles kenikmatan yang mematikan bagi insan, dari arah yang tak disadari bahwa racun mematikan tersembunyi di balik makanan berlemak."
            },
            {
                no: 10,
                arabic: "وَاخْشَ الدَّسَائِسَ مِنْ جُوْعٍ وَمِنْ شِبَعٍ ۞ فَرُبَّ مَخْمَصَةٍ شَرٌّ مِنَ التُّخَمِ",
                latin: "Wakhsyad-dasâ'isa min jû‘in wa min syiba‘in ۞ fa rubba makhmashatin syarrun minat-tukhami",
                translation: "Takutlah engkau akan tipu daya lapar dan kenyang yang melampaui batas, sebab acap kali rasa lapar justru lebih membahayakan daripada kekenyangan."
            }
        ]
    },
    {
        id: 3,
        title: "Bab III: Pujian kepada Baginda Nabi Muhammad SAW",
        arabicTitle: "الفصل الثالث: في مدح النبي صلى الله عليه وسلم",
        desc: "Untaian madah pujian atas keluhuran budi pekerti, kemuliaan nasab, dan kesempurnaan fisik Nabi Agung Muhammad SAW.",
        refrain: {
            arabic: "مَوْلَايَ صَلِّ وَسَلِّمْ دَآئِــمًا أَبَـدًا ۞ عَلَى حَبِيْبِـكَ خَيْــرِ الْخَلْقِ كُلِّهِمِ",
            latin: "Maulâya shalli wa sallim dâ'iman abadan ۞ ‘alâ ḫabîbika khairil-khalqi kullihimi",
            translation: "Wahai Tuhanku, limpahkanlah selalu shalawat dan salam selamanya, atas kekasih-Mu yang terbaik di antara seluruh ciptaan."
        },
        verses: [
            {
                no: 1,
                arabic: "ظَلَمْتُ سُنَّةَ مَنْ أَحْيَا الظَّلَامَ إِلَى ۞ أَنِ اشْتَكَتْ قَدَمَاهُ الضُّرَّ مِنْ وَرَمِ",
                latin: "Dhalamtu sunnata man aḫyadh-dhalâma ilâ ۞ anisytakat qadamâhudl-dlurra min warami",
                translation: "Sungguh aku telah menzhalimi sunnah Nabi yang senantiasa menghidupkan malam dengan ibadah, hingga kedua telapak kakinya bengkak mengadu kepayahan."
            },
            {
                no: 2,
                arabic: "وَشَدَّ مِنْ سَغَبٍ حَشْوَاهُ وَاطَّوَتْ ۞ تَحْتَ الْحِجَارَةِ كَشْحًا مُتْرَفَ الْأَدَمِ",
                latin: "Wa syadda min saghabin ḫasywâhu wath-thawat ۞ taḫtal-ḫijârati kasy-ḫan mutrafal-adami",
                translation: "Beliau mengikat perutnya lantaran rasa lapar, dan melilitkan batu di atas lambungnya yang putih halus mulia."
            },
            {
                no: 3,
                arabic: "وَرَاوَدَتْهُ الْجِبَالُ الشُّمُّ مِنْ ذَهَبٍ ۞ عَنْ نَفْسِهِ فَأَرَاهَا أَيَّمَا شَمَمِ",
                latin: "Wa râwadat-hul-jibâlusy-syummu min dzahabin ۞ ‘an nafsihi fa-arâhâ ayyamâ syamami",
                translation: "Gunung-gunung tinggi menjulang menawarkan diri berwujud emas permata demi beliau, namun beliau menunjukkan keluhuran martabat kezuhudan yang tiada tertandingi."
            },
            {
                no: 4,
                arabic: "وَأَكَّدَتْ زُهْدَهُ فِيْهَا ضَرُوْرَتُهُ ۞ إِنَّ الضَّرُوْرَةَ لَا تَعْدُوْ عَلَى الْعِصَمِ",
                latin: "Wa akkadat zuhdahu fîhâ dlarûratuhu ۞ innad-dlarûrata lâ ta‘dû ‘alal-‘ishami",
                translation: "Kezuhudan beliau justru kian kokoh di tengah keadaan darurat, sungguh keterdesakan hidup takkan pernah mampu menodai keterjagaan ('ishmah) para nabi."
            },
            {
                no: 5,
                arabic: "وَكَيْفَ تَدْعُوْ إِلَى الدُّنْيَا ضَرُوْرَةُ مَنْ ۞ لَوْلَاهُ لَمْ تَخْرُجِ الدُّنْيَا مِنَ الْعَدَمِ",
                latin: "Wa kaifa tad‘û ilad-dunyâ dlarûratu man ۞ laulâhu lam takhrujid-dunyâ minal-‘adami",
                translation: "Bagaimana mungkin dunia fana sanggup menggoda sosok agung yang andaikan bukan karenanya, alam semesta dunia ini takkan pernah diciptakan dari ketiadaan?"
            },
            {
                no: 6,
                arabic: "مُحَمَّدٌ سَيِّدُ الْكَوْنَيْنِ وَالثَّقَلَيْـ ۞ ـنِ وَالْفَرِيْقَيْنِ مِنْ عُرْبٍ وَمِنْ عَجَمِ",
                latin: "Muḫammadun sayyidul-kaunaini wats-tsaqalai- ۞ ni wal-farîqaini min ‘urbin wa min ‘ajami",
                translation: "Baginda Muhammad adalah junjungan dua alam semesta (dunia dan akhirat), pemimpin bangsa jin dan manusia, serta raja bagi bangsa Arab maupun bangsa non-Arab ('Ajam)."
            },
            {
                no: 7,
                arabic: "نَبِيُّنَا الْآمِرُ النَّاهِيْ فَلَا أَحَدٌ ۞ أَبَرَّ فِيْ قَوْلِ لَا مِنْهُ وَلَا نَعَمِ",
                latin: "Nabiyyunâl-âmirun-nâhî falâ aḫadun ۞ abarra fî qauli lâ minhu wa lâ na‘ami",
                translation: "Nabi kita sang pemandu kebajikan dan pencegah kemunkaran, tiada seorang pun yang lebih benar dan adil ucapannya dalam mengucap 'tidak' ataupun 'ya'."
            },
            {
                no: 8,
                arabic: "هُوَ الْحَبِيْبُ الَّذِيْ تُرْجَى شَفَاعَتُهُ ۞ لِكُلِّ هَوْلٍ مِنَ الْأَهْوَالِ مُقْتَحَمِ",
                latin: "Huwal-ḫabîbul-ladzî turjâ syafâ‘atuhu ۞ likulli haulin minal-ahwâli muqtaḫami",
                translation: "Dialah kekasih tercinta yang senantiasa dinanti-nantikan syafa'at pertolongannya, dalam menghadapi setiap huru-hara dahsyat di hari kiamat kelak."
            },
            {
                no: 9,
                arabic: "دَعَا إِلَى اللهِ فَالْمُسْتَمْسِكُوْنَ بِهِ ۞ مُسْتَمْسِكُوْنَ بِحَبْلٍ غَيْرِ مُنْفَصِمِ",
                latin: "Da‘â ilallâhi fal-mustamsikûna bihi ۞ mustamsikûna biḫablin ghairi munfashimi",
                translation: "Beliau mengajak manusia menuju keridhaan Allah, maka siapa saja yang berpegang teguh pada ajarannya, sesungguhnya telah berpegang pada tali agama yang tiada akan putus selamanya."
            },
            {
                no: 10,
                arabic: "فَاقَ النَّبِيِّيْنَ فِيْ خَلْقٍ وَفِيْ خُلُقٍ ۞ وَلَمْ يُدَانُوْهُ فِيْ عِلْمٍ وَلَا كَرَمِ",
                latin: "Fâqan-nabiyyîna fî khalqin wa fî khuluqin ۞ wa lam yudânûhu fî ‘ilmin wa lâ karami",
                translation: "Beliau mengungguli para nabi lainnya dalam keindahan rupa fisik dan kemuliaan akhlak budi pekerti, dan mereka tiada mampu mendekati keluasan ilmu dan kedermawanannya."
            },
            {
                no: 11,
                arabic: "وَكُلُّهُمْ مِنْ رَسُوْلِ اللهِ مُلْتَمِسٌ ۞ غَرْفًا مِنَ الْبَحْرِ أَوْ رَشْفًا مِنَ الدِّيَمِ",
                latin: "Wa kulluhum min Rasûlillâhi multamisun ۞ gharfan minal-baḫri au rasyfan minad-diyami",
                translation: "Seluruh nabi dan rasul memohon berkah dari keagungan Rasulullah SAW, laksana mengambil seciduk air dari samudra nan luas atau tegukan berkah dari hujan lebat."
            },
            {
                no: 12,
                arabic: "فَمَبْلَغُ الْعِلْمِ فِيْهِ أَنَّهُ بَشَرٌ ۞ وَأَنَّهُ خَيْرُ خَلْقِ اللهِ كُلِّهِمِ",
                latin: "Fa mablaghul-‘ilmi fîhi annahu basyarun ۞ wa annahu khairu khalqillâhi kullihimi",
                translation: "Maka puncak pemahaman akal manusia tentangnya adalah bahwa beliau hakikatnya seorang manusia, namun beliau adalah makhluk ciptaan Allah yang paling mulia dan agung di jagat raya."
            }
        ]
    },
    {
        id: 4,
        title: "Bab IV: Kelahiran Rasulullah SAW",
        arabicTitle: "الفصل الرابع: في مولده عليه الصلاة والسلام",
        desc: "Kisah kelahiran baginda Nabi Muhammad SAW yang dipenuhi cahaya suci dan pertanda keruntuhan kekafiran.",
        refrain: {
            arabic: "مَوْلَايَ صَلِّ وَسَلِّمْ دَآئِــمًا أَبَـدًا ۞ عَلَى حَبِيْبِـكَ خَيْــرِ الْخَلْقِ كُلِّهِمِ",
            latin: "Maulâya shalli wa sallim dâ'iman abadan ۞ ‘alâ ḫabîbika khairil-khalqi kullihimi",
            translation: "Wahai Tuhanku, limpahkanlah selalu shalawat dan salam selamanya, atas kekasih-Mu yang terbaik di antara seluruh ciptaan."
        },
        verses: [
            {
                no: 1,
                arabic: "أَبَانَ مَوْلِدُهُ عَنْ طِيْبِ عُنْصُرِهِ ۞ يَا طِيْبَ مُبْتَدَإٍ مِنْهُ وَمُخْتَتَمِ",
                latin: "Abâna mauliduhu ‘an thîbi ‘unshurihi ۞ yâ thîba mubtada'in minhu wa mukhtatami",
                translation: "Kelahirannya menampakkan keharuman asal-usul nasabnya yang suci murni; sungguh alangkah mulianya awal permulaan dan akhir penutup kelahirannya!"
            },
            {
                no: 2,
                arabic: "يَوْمٌ تَفَرَّسَ فِيْهِ الْفُرْسُ أَنَّهُمُ ۞ قَدْ أُنْذِرُوْا بِحُلُوْلِ الْبُؤْسِ وَالنِّقَمِ",
                latin: "Yaumun tafarrasa fîhil-fursu annahumu ۞ qad undzirû biḫulûlil-bu'si wan-niqami",
                translation: "Sebuah hari agung di mana bangsa Persia menyaksikan firasat bahwa malapetaka kehancuran dan kebinasaan telah diambang pintu kekuasaan mereka."
            },
            {
                no: 3,
                arabic: "وَبَاتَ إِيْوَانُ كِسْرَى وَهْوَ مُنْصَدِعٌ ۞ كَشَمْلِ أَصْحَابِ كِسْرَى غَيْرَ مُلْتَئِمِ",
                latin: "Wa bâta îwânu kisrâ wahwa munshada‘un ۞ kasyamli ash-ḫâbi kisrâ ghaira multa'imi",
                translation: "Di malam kelahirannya istana megah Kisra retak terbelah, sebagaimana terpecah-belahnya kekuatan pengikut Kisra tanpa dapat bersatu kembali."
            },
            {
                no: 4,
                arabic: "وَالنَّارُ خَامِدَةُ الْأَنْفَاسِ مِنْ أَسَفٍ ۞ عَلَيْهِ وَالنَّهْرُ سَاهِيْ الْعَيْنِ مِنْ سَدَمِ",
                latin: "Wan-nâru khâmidatul-anfâsi min asafin ۞ ‘alaihi wan-nahru sâhil-‘aini min sadami",
                translation: "Api sesembahan kaum Majusi padam terdiam didera kesedihan, dan aliran air danau Sawah mengering surut didera kekecewaan."
            },
            {
                no: 5,
                arabic: "وَسَاءَ سَاوَةَ أَنْ غَاضَتْ بُحَيْرَتُهَا ۞ وَرُدَّ وَارِدُهَا بِالْغَيْظِ حِيْنَ ظَمِيْ",
                latin: "Wa sâ'a sâwata an ghâdlat buḫairatuhâ ۞ wa rudda wâriduhâ bil-ghaidhi ḫîna dlamî",
                translation: "Sungguh berduka para penduduk negeri Sawah saat danau mereka mengering airnya, dan para pencari air kembali pulang dengan rasa haus dan kecewa membara."
            }
        ]
    },
    {
        id: 5,
        title: "Bab V: Mukjizat-Mukjizat Rasulullah SAW",
        arabicTitle: "الفصل الخامس: في معجزاته عليه الصلاة والسلام",
        desc: "Bukti-bukti kenabian dan mukjizat nyata Rasulullah SAW yang menundukkan akal serta menenteramkan hati orang beriman.",
        refrain: {
            arabic: "مَوْلَايَ صَلِّ وَسَلِّمْ دَآئِــمًا أَبَـدًا ۞ عَلَى حَبِيْبِـكَ خَيْــرِ الْخَلْقِ كُلِّهِمِ",
            latin: "Maulâya shalli wa sallim dâ'iman abadan ۞ ‘alâ ḫabîbika khairil-khalqi kullihimi",
            translation: "Wahai Tuhanku, limpahkanlah selalu shalawat dan salam selamanya, atas kekasih-Mu yang terbaik di antara seluruh ciptaan."
        },
        verses: [
            {
                no: 1,
                arabic: "جَاءَتْ لِدَعْوَتِهِ الْأَشْجَارُ سَاجِدَةً ۞ تَمْشِيْ إِلَيْهِ عَلَى سَاقٍ بِلَا قَدَمِ",
                latin: "Jâ'at lida‘watihil-asyjâru sâjidatan ۞ tamsyî ilaihi ‘alâ sâqin bilâ qadami",
                translation: "Pepohonan datang bersujud memenuhi panggilannya, berarak melangkah mendekat kepadanya di atas batang tanpa telapak kaki."
            },
            {
                no: 2,
                arabic: "كَأَنَّمَا سَطَرَتْ سَطْرًا لِمَا كَتَبَتْ ۞ فُرُوْعُهَا مِنْ بَدِيْعِ الْخَطِّ فِي اللَّقَمِ",
                latin: "Ka'annamâ satharat sathran limâ katabat ۞ furû‘uhâ min badî‘il-khath-thi fil-laqami",
                translation: "Seakan-akan jejak dahan dan ranting pohon itu menorehkan kaligrafi indah di tengah jalan raya sebagai tanda penghormatan bagi beliau."
            },
            {
                no: 3,
                arabic: "مِثْلَ الْغَمَامَةِ أَنَّى سَارَ سَائِرَةً ۞ تَقِيْهِ حَرَّ وَطِيْسٍ لِلْهَجِيْرِ حَمِيْ",
                latin: "Mitslal-ghamâmati annâ sâra sâ'iratan ۞ taqîhi ḫarra wathîsin lil-hajîri ḫamî",
                translation: "Laksana awan putih nan teduh yang senantiasa menaungi ke mana pun beliau melangkah, melindunginya dari terik panasnya sengatan matahari di padang pasir."
            },
            {
                no: 4,
                arabic: "أَقْسَمْتُ بِالْقَمَرِ الْمُنْشَقِّ إِنَّ لَهُ ۞ مِنْ قَلْبِهِ نِسْبَةً مَبْرُوْرَةَ الْقَسَمِ",
                latin: "AqsFoundtu bil-qamaril-munsyaqqi inna lahu ۞ min qalbihi nisbatan mabrûratil-qasami",
                translation: "Aku bersumpah demi bulan purnama yang terbelah dua, bahwa mukjizat itu memiliki ikatan keserupaan suci dengan hatinya yang mulia."
            },
            {
                no: 5,
                arabic: "وَمَا حَوَى الْغَارُ مِنْ خَيْرٍ وَمِنْ كَرَمِ ۞ وَكُلُّ طَرْفٍ مِنَ الْكُفَّارِ عَنْهُ عَمِيْ",
                latin: "Wa mâ ḫawal-ghâru min khairin wa min karami ۞ wa kullu tharfin minal-kuffâri ‘anhu ‘amî",
                translation: "Dan betapa agung kebaikan serta kemuliaan yang dikandung di dalam Gua Tsur, tatkala pandangan mata kaum kafir dibuat buta tak melihat keberadaannya."
            }
        ]
    },
    {
        id: 6,
        title: "Bab VI: Kemuliaan Al-Qur'an dan Keutamaannya",
        arabicTitle: "الفصل السادس: في شرف القرآن ومدحه",
        desc: "Ketinggian mukjizat Al-Qur'an al-Karim yang kekal abadi melampaui seluruh mukjizat para nabi terdahulu.",
        refrain: {
            arabic: "مَوْلَايَ صَلِّ وَسَلِّمْ دَآئِــمًا أَبَـدًا ۞ عَلَى حَبِيْبِـكَ خَيْــرِ الْخَلْقِ كُلِّهِمِ",
            latin: "Maulâya shalli wa sallim dâ'iman abadan ۞ ‘alâ ḫabîbika khairil-khalqi kullihimi",
            translation: "Wahai Tuhanku, limpahkanlah selalu shalawat dan salam selamanya, atas kekasih-Mu yang terbaik di antara seluruh ciptaan."
        },
        verses: [
            {
                no: 1,
                arabic: "دَعْنِيْ وَوَصْفِيْ آيَاتٍ لَهُ ظَهَرَتْ ۞ ظُهُوْرَ نَارِ الْقِرَى لَيْلًا عَلَى عَلَمِ",
                latin: "Da‘nî wa washfî âyâtin lahu dhaharat ۞ dhuhûra nâril-qirâ lailan ‘alâ ‘alami",
                translation: "Biarkanlah daku merangkai untaian sifat mukjizat Al-Qur'an yang tampak benderang, laksana api penyambut tamu di puncak bukit pada malam kelam."
            },
            {
                no: 2,
                arabic: "فَالدُّرُّ يَزْدَادُ حُسْنًا وَهْوَ مُنْتَظِمٌ ۞ وَلَيْسَ يَنْقُصُ قَدْرًا غَيْرَ مُنْتَظِمِ",
                latin: "Fad-durru yazdâdu ḫusnan wahwa muntadhimun ۞ wa laisa yanqushu qadran ghaira muntadhimi",
                translation: "Mutiara yang terangkai untaian rapi kian memesona parasnya, namun kemuliaannya takkan berkurang meski terlepas berserakan."
            },
            {
                no: 3,
                arabic: "فَمَا تَطَاوَلَ آمَالُ الْمَدِيْحِ إِلَى ۞ مَا فِيْهِ مِنْ كَرَمِ الْأَخْلَاقِ وَالشِّيَمِ",
                latin: "Famâ tathâwala âmâlul-madîḫi ilâ ۞ mâ fîhi min karamil-akhlâqi wasy-syiyami",
                translation: "Maka cita-cita pujian bait syair manapun takkan pernah mampu menyaingi apa yang terangkum di dalam Al-Qur'an tentang kemuliaan akhlak baginda Nabi."
            },
            {
                no: 4,
                arabic: "آيَاتُ حَقٍّ مِنَ الرَّحْمٰنِ مُحْدَثَةٌ ۞ قَدِيْمَةٌ صِفَةُ الْمَوْصُوْفِ بِالْقِدَمِ",
                latin: "Âyâtu ḫaqqin minar-Raḫmâni muḫdatsatun ۞ qadîmatun shifatul-maushûfi bil-qidami",
                translation: "Ayat-ayat kebenaran firman Allah Yang Maha Pengasih diturunkan di masa kini, namun ia sejatinya qadim (kekal) sebagai sifat Dzat Yang Maha Qadim."
            },
            {
                no: 5,
                arabic: "لَمْ تَقْتَرِنْ بِزَمَانٍ وَهْيَ تُخْبِرُنَا ۞ عَنِ الْمَعَادِ وَعَنْ عَادٍ وَعَنْ إِرَمِ",
                latin: "Lam taqtarin bizamânin wahya tukhbirunâ ۞ ‘anil-ma‘âdi wa ‘an ‘âdin wa ‘an irami",
                translation: "Al-Qur'an tiada terikat oleh kurun waktu, ia mengabarkan kita tentang hari akhir serta kisah kaum 'Ad dan megahnya kota Iram."
            }
        ]
    },
    {
        id: 7,
        title: "Bab VII: Peristiwa Isra' dan Mi'raj Rasulullah SAW",
        arabicTitle: "الفصل السابع: في إسرائه ومعراجه",
        desc: "Perjalanan agung Rasulullah SAW dari Masjidil Haram ke Masjidil Aqsha hingga menembus Sidratul Muntaha.",
        refrain: {
            arabic: "مَوْلَايَ صَلِّ وَسَلِّمْ دَآئِــمًا أَبَـدًا ۞ عَلَى حَبِيْبِـكَ خَيْــرِ الْخَلْقِ كُلِّهِمِ",
            latin: "Maulâya shalli wa sallim dâ'iman abadan ۞ ‘alâ ḫabîbika khairil-khalqi kullihimi",
            translation: "Wahai Tuhanku, limpahkanlah selalu shalawat dan salam selamanya, atas kekasih-Mu yang terbaik di antara seluruh ciptaan."
        },
        verses: [
            {
                no: 1,
                arabic: "سَرَيْتَ مِنْ حَرَمٍ لَيْلًا إِلَى حَرَمِ ۞ كَمَا سَرَى الْبَدْرُ فِيْ دَاجٍ مِنَ الظُّلَمِ",
                latin: "Saraita min ḫaramin lailan ilâ ḫarami ۞ kamâ saral-badru fî dâjin minadh-dhulami",
                translation: "Engkau berjalan di malam hari dari satu tanah suci ke tanah suci lainnya, laksana bulan purnama melintas membelah kegelapan malam."
            },
            {
                no: 2,
                arabic: "وَبِتَّ تَرْقَى إِلَى أَنْ نِلْتَ مَنْزِلَةً ۞ مِنْ قَابِ قَوْسَيْنِ لَمْ تُدْرَكْ وَلَمْ تُرَمِ",
                latin: "Wa bitta tarqâ ilâ an nilta manzvalidationatan ۞ min qâbi qausaini lam tudrak wa lam turami",
                translation: "Engkau terus membubung tinggi hingga meraih kedudukan sedekat dua ujung busur panah (*qâba qausain*), martabat luhur yang tiada pernah dicapai dan dijangkau siapa pun."
            },
            {
                no: 3,
                arabic: "وَقَدَّمَتْكَ جَمِيْعُ الْأَنْبِيَاءِ بِهَا ۞ وَالرُّسْلِ تَقْدِيْمَ مَخْدُوْمٍ عَلَى خَدَمِ",
                latin: "Wa qaddamatka jamî‘ul-anbiyâ'i bihâ ۞ war-rusli taqdîma makhdûmin ‘alâ khadami",
                translation: "Seluruh para nabi dan para rasul mendudukkanmu sebagai imam salat di Baitul Maqdis, layaknya penghormatan hamba sahaya kepada tuannya."
            },
            {
                no: 4,
                arabic: "وَأَنْتَ تَخْتَرِقُ السَّبْعَ الطِّبَاقَ بِهِمْ ۞ فِيْ مَوْكِبٍ كُنْتَ فِيْهِ صَاحِبَ الْعَلَمِ",
                latin: "Wa anta takhtariqus-sab‘ath-thibâqa bihim ۞ fî maukibin kunta fîhi shâḫibal-‘alami",
                translation: "Dan engkau menembus tujuh lapisan langit di hadapan mereka, dalam iring-iringan agung di mana engkaulah pembawa panji kemuliaan."
            },
            {
                no: 5,
                arabic: "حَتَّى إِذَا لَمْ تَدَعْ شَأْوًا لِمُسْتَبِقٍ ۞ مِنَ الدُّنُوِّ وَلَا مَرْقًى لِمُسْتَنِمِ",
                latin: "Ḫattâ idzâ lam tada‘ sya'wan limustabiqin ۞ minad-dunuwwi wa lâ marqan limustanimi",
                translation: "Hingga tiada lagi menyisakan puncak kedekatan bagi siapa pun yang berlomba, dan tiada tangga martabat lagi bagi para pencari ketinggian."
            }
        ]
    },
    {
        id: 8,
        title: "Bab VIII: Perjuangan dan Jihad Rasulullah SAW",
        arabicTitle: "الفصل الثامن: في جهاد النبي صلى الله عليه وسلم",
        desc: "Ketegaran iman, keberanian para sahabat, dan kemenangan dakwah Islam di bawah kepemimpinan Rasulullah SAW.",
        refrain: {
            arabic: "مَوْلَايَ صَلِّ وَسَلِّمْ دَآئِــمًا أَبَـدًا ۞ عَلَى حَبِيْبِـكَ خَيْــرِ الْخَلْقِ كُلِّهِمِ",
            latin: "Maulâya shalli wa sallim dâ'iman abadan ۞ ‘alâ ḫabîbika khairil-khalqi kullihimi",
            translation: "Wahai Tuhanku, limpahkanlah selalu shalawat dan salam selamanya, atas kekasih-Mu yang terbaik di antara seluruh ciptaan."
        },
        verses: [
            {
                no: 1,
                arabic: "رَاعَتْ قُلُوْبَ الْعِدَا أَنْبَاءُ بِعْثَتِهِ ۞ كَنَبْأَةٍ أَجْفَلَتْ غُفْلًا مِنَ الْغَنَمِ",
                latin: "Râ‘at qulûbal-‘idâ anbâ'u bi‘tsatihi ۞ kanab'atin ajfalat ghuflan minal-ghanami",
                translation: "Berita diutusnya beliau menggentarkan hati para musuh musrik, bagai auman singa yang mengejutkan kawanan domba yang tengah terlena."
            },
            {
                no: 2,
                arabic: "مَا زَالَ يَلْقَاهُمُ فِيْ كُلِّ مُعْتَرَكٍ ۞ حَتَّى حَكَوْا بِالْقَنَا لَحْمًا عَلَى عَنَمِ",
                latin: "Mâ zâla yalqâhumu fî kulli mu‘tarakin ۞ ḫattâ ḫakau bil-qanâ laḫman ‘alâ ‘anami",
                translation: "Beliau tiada henti menghadapi para penentang di setiap medan pertempuran, hingga tubuh musuh laksana daging berserakan di ujung tombak."
            },
            {
                no: 3,
                arabic: "كَأَنَّ دِيْنَ الْهُدَى ضَيْفٌ أَلَمَّ بِهِمْ ۞ بِكُلِّ قَرْمٍ إِلَى لَحْمِ الْعِدَا قَرِمِ",
                latin: "Ka'anna dînal-hudâ dlaifun alamma bihim ۞ bikulli qarmin ilâ laḫmil-‘idâ qarimi",
                translation: "Seolah-olah agama petunjuk ini adalah tamu mulia yang singgah, disambut oleh para kesatria pemberani yang gagah perkasa."
            },
            {
                no: 4,
                arabic: "يَجُرُّ بَحْرَ خَمِيْسٍ فَوْقَ سَابِحَةٍ ۞ يَرْمِيْ بِمَوْجٍ مِنَ الْأَبْطَالِ مُلْتَطِمِ",
                latin: "Yajurru baḫra khamîsin fauqa sâbiḫatin ۞ yarmî bimaujin minal-abthâli multathimi",
                translation: "Beliau memimpin barisan samudra tentara di atas kuda-kuda tangguh, menerjang dengan gulungan ombak para pahlawan pejuang syahid."
            },
            {
                no: 5,
                arabic: "مِنْ كُلِّ مُنْتَدِبٍ للهِ مُحْتَسِبٍ ۞ يَسْطُوْ بِمُسْتَأْصِلٍ لِلْكُفْرِ مُصْطَلِمِ",
                latin: "Min kulli muntadibin lillâhi muḫtasibin ۞ yasthû bimusta'shilin lil-kufri mushthalimi",
                translation: "Para prajurit yang ikhlas berjuang semata demi Allah dan mengharap pahala-Nya, menyerang guna mencabut akar kekufuran hingga luluh lantak."
            }
        ]
    },
    {
        id: 9,
        title: "Bab IX: Tawasul kepada Nabi dan Pengakuan Dosa",
        arabicTitle: "الفصل التاسع: في التوسل بالنبي واستقالة الذنوب",
        desc: "Permohonan ampunan atas kelalaian hidup dan bertawasul dengan kedudukan mulia baginda Nabi Muhammad SAW.",
        refrain: {
            arabic: "مَوْلَايَ صَلِّ وَسَلِّمْ دَآئِــمًا أَبَـدًا ۞ عَلَى حَبِيْبِـكَ خَيْــرِ الْخَلْقِ كُلِّهِمِ",
            latin: "Maulâya shalli wa sallim dâ'iman abadan ۞ ‘alâ ḫabîbika khairil-khalqi kullihimi",
            translation: "Wahai Tuhanku, limpahkanlah selalu shalawat dan salam selamanya, atas kekasih-Mu yang terbaik di antara seluruh ciptaan."
        },
        verses: [
            {
                no: 1,
                arabic: "خَدَمْتُهُ بِمَدِيْحٍ أَسْتَقِيْلُ بِهِ ۞ ذُنُوْبَ عُمْرٍ مَضَى فِيْ الشِّعْرِ وَالْخِدَمِ",
                latin: "Khadamtuhu bimadîḫin astaqîlu bihi ۞ dzunûba ‘umrin madlâ fisy-syi‘ri wal-khidami",
                translation: "Aku berkhidmat kepada beliau dengan melantunkan bait-bait pujian, seraya memohon ampunan atas dosa-dosa umur yang telah lewat dalam bersyair dan melayani duniawi."
            },
            {
                no: 2,
                arabic: "إِذْ قَلَّدَانِيَ مَا تُخْشَى عَوَاقِبُهُ ۞ كَأَنَّنِيْ بِهِمَا هَدْيٌ مِنَ النَّعَمِ",
                latin: "Idz qalladâniya mâ tukhsyâ ‘awâqibuhu ۞ ka'annanî bihimâ hadyun minan-na‘ami",
                translation: "Sebab keduanya telah mengalungi diriku dengan beban dosa yang kutakuti akibatnya, seakan-akan aku laksana unta kurban persembahan."
            },
            {
                no: 3,
                arabic: "أَطَعْتُ غَيَّ الصِّبَا فِيْ الْحَالَتَيْنِ وَمَا ۞ حَصَلْتُ إِلَّا عَلَى الْآثَامِ وَالنَّدَمِ",
                latin: "Atha‘tu ghayyash-shibâ fîl-ḫâlataini wa mâ ۞ ḫashaltu illâ ‘alal-âtsâmi wan-nadami",
                translation: "Kuturuti bujuk rayu masa muda dalam dua keadaan itu, dan tiada hasil yang kuperoleh selain limpahan dosa dan penyesalan mendalam."
            },
            {
                no: 4,
                arabic: "فَيَا خَسَارَةَ نَفْسٍ فِيْ تِجَارَتِهَا ۞ لَمْ تَشْتَرِ الدِّيْنَ بِالدُّنْيَا وَلَمْ تَسُمِ",
                latin: "Fa yâ khasârata nafsin fî tijâratihâ ۞ lam tasytarid-dîna bid-dunyâ wa lam tasumi",
                translation: "Alangkah meruginya jiwaku dalam perniagaannya, yang tiada membeli agama dengan harta dunia dan tiada pula menawarnya."
            },
            {
                no: 5,
                arabic: "وَمَنْ يَبِعْ آجِلًا مِنْهُ بِعَاجِلِهِ ۞ يَبِنْ لَهُ الْغَبْنُ فِيْ بَيْعٍ وَفِيْ سَلَمِ",
                latin: "Wa man yabi‘ âjilan minhu bi‘âjilihi ۞ yabin lahul-ghabnu fî bai‘in wa fî salami",
                translation: "Dan barangsiapa menukar kenikmatan abadi akhirat dengan kesenangan sesaat dunia, niscaya akan nyata kerugiannya dalam jual-beli dan perniagaan."
            }
        ]
    },
    {
        id: 10,
        title: "Bab X: Bermunajat dan Memohon Hajat",
        arabicTitle: "الفصل العاشر: في المناجاة وعرض الحاجات",
        desc: "Doa pamungkas permohonan hajat, ampunan dosa, dan limpahan shalawat salam kepada Rasulullah SAW, keluarga, dan para sahabat.",
        refrain: {
            arabic: "مَوْلَايَ صَلِّ وَسَلِّمْ دَآئِــمًا أَبَـدًا ۞ عَلَى حَبِيْبِـكَ خَيْــرِ الْخَلْقِ كُلِّهِمِ",
            latin: "Maulâya shalli wa sallim dâ'iman abadan ۞ ‘alâ ḫabîbika khairil-khalqi kullihimi",
            translation: "Wahai Tuhanku, limpahkanlah selalu shalawat dan salam selamanya, atas kekasih-Mu yang terbaik di antara seluruh ciptaan."
        },
        verses: [
            {
                no: 1,
                arabic: "يَا أَكْرَمَ الْخَلْقِ مَا لِيْ مَنْ أَلُوْذُ بِهِ ۞ سِوَاكَ عِنْدَ حُلُوْلِ الْحَادِثِ الْعَمِمِ",
                latin: "Yâ akramal-khalqi mâ lî man alûdzu bihi ۞ siwâka ‘inda ḫulûlil-ḫâditsil-‘amimi",
                translation: "Wahai makhluk ciptaan Allah yang paling mulia! Tiada tempat bagiku untuk berlindung selain engkau tatkala musibah kedahsyatan hari kiamat melanda merata."
            },
            {
                no: 2,
                arabic: "وَلَنْ يَضِيْقَ رَسُوْلَ اللهِ جَاهُكَ بِيْ ۞ إِذَا الْكَرِيْمُ تَجَلَّى بِاسْمِ مُنْتَقِمِ",
                latin: "Wa lan yadhîqa Rasûlallâhi jâhuka bî ۞ idzal-Karîmu tajallâ bismi Muntaqimi",
                translation: "Kedudukan dan syafa'atmu yang agung takkan pernah sempit melindungiku wahai Rasulullah, tatkala Dzat Yang Maha Pemurah menampakkan murka-Nya dengan nama Al-Muntaqim (Maha Penyiksa)."
            },
            {
                no: 3,
                arabic: "فَإِنَّ مِنْ جُوْدِكَ الدُّنْيَا وَضَرَّتَهَا ۞ وَمِنْ عُلُوْمِكَ عِلْمَ اللَّوْحِ وَالْقَلَمِ",
                latin: "Fa-inna min jûdikad-dunyâ wa dlarratahâ ۞ wa min ‘ulûmika ‘ilmal-lauḫi wal-qalami",
                translation: "Karena sesungguhnya sebagian dari kemurahanmu adalah terciptanya dunia dan akhirat, dan sebagian dari ilmumu adalah pengetahuan tentang Lauh Mahfuzh dan pena takdir."
            },
            {
                no: 4,
                arabic: "يَا نَفْسُ لَا تَقْنَطِيْ مِنْ زَلَّةٍ عَظُمَتْ ۞ إِنَّ الْكَبَائِرَ فِيْ الْغُفْرَانِ كاللَّمَمِ",
                latin: "Yâ nafsu lâ taqnathî min zallatin ‘adhumat ۞ innal-kabâ'ira fîl-ghufrâni kal-lamami",
                translation: "Wahai jiwaku, janganlah engkau berputus asa karena dosa besar yang telah kaulakukan, sungguh dosa-dosa besar itu di hadapan keluasan ampunan Allah hanyalah laksana dosa-dosa kecil."
            },
            {
                no: 5,
                arabic: "لَعَلَّ رَحْمَةَ رَبِّيْ حِيْنَ يَقْسِمُهَا ۞ تَأْتِيْ عَلَى حَسَبِ الْعِصْيَانِ فِيْ الْقِسَمِ",
                latin: "La‘alla raḫmata Rabbî ḫîna yaqsimuhâ ۞ ta'tî ‘alâ ḫasabil-‘ishyâni fîl-qisami",
                translation: "Semoga tatkala Tuhanku membagikan rahmat-Nya kelak, bagian rahmat itu dilimpahkan sesuai dengan besarnya kadar kedurhakaan hamba-Nya."
            },
            {
                no: 6,
                arabic: "يَا رَبِّ وَاجْعَلْ رَجَائِيْ غَيْرَ مُنْعَكِسٍ ۞ لَدَيْكَ وَاجْعَلْ حِسَابِيْ غَيْرَ مُنْخَرِمِ",
                latin: "Yâ Rabbi waj‘al rajâ'î ghaira mun‘akisin ۞ ladaika waj‘al ḫisâbî ghaira munkharimi",
                translation: "Wahai Tuhanku, jadikanlah harapanku kepada-Mu tiada berbalik hampa, dan jadikanlah penghitungan amalku tiada binasa terputus."
            },
            {
                no: 7,
                arabic: "وَالْطُفْ بِعَبْدِكَ فِيْ الدَّارَيْنِ إِنَّ لَهُ ۞ صَبْرًا مَتَى تَدْعُهُ الْأَهْوَالُ ينهَزِمِ",
                latin: "Walthuf bi‘abdika fid-dâraini inna lahu ۞ shabran matâ tad‘uhul-ahwâlu yanhazimi",
                translation: "Limpahkanlah kasih sayang-Mu kepada hamba-Mu ini di dunia dan akhirat, sungguh kesabarannya amatlah lemah dan rapuh tatkala diterpa berbagai huru-hara."
            },
            {
                no: 8,
                arabic: "يَا رَبِّ بِالْمُصْطَفَى بَلِّغْ مَقَاصِدَنَا ۞ وَاغْفِرْ لَنَا مَا مَضَى يَا وَاسِعَ الْكَرَمِ",
                latin: "Yâ Rabbi bil-Mushthafâ balligh maqâshidanâ ۞ waghfir lanâ mâ madlâ yâ Wâsi‘al-karami",
                translation: "Wahai Tuhanku, berkat wasilah Nabi pilihan-Mu sampaikanlah segala maksud tujuan cita-cita kami, dan ampunilah dosa-dosa kami yang telah lalu, wahai Dzat Yang Maha Luas Kedermawanan-Nya."
            },
            {
                no: 9,
                arabic: "وَاغْفِرْ إِلٰهِيْ لِكُلِّ الْمُسْلِمِيْنَ بِمَا ۞ يَتْلُوْهُ فِيْ الْمَسْجِدِ الْأَقْصَى وَفِيْ الْحَرَمِ",
                latin: "Waghfir Ilâhî likullil-muslimîna bimâ ۞ yatlûhu fîl-Masjidil-Aqshâ wa fîl-Ḫarami",
                translation: "Dan ampunilah ya Allah seluruh kaum muslimin, berkat ayat-ayat suci yang senantiasa mereka lantunkan di Masjidil Aqsha dan di Masjidil Haram."
            },
            {
                no: 10,
                arabic: "ثُمَّ الصَّلَاةُ عَلَى النَّبِيِّ وَآلِهِ ۞ وَصَحْبِهِ وَالتَّابِعِيْنَ أُوْلِي الْكَرَمِ",
                latin: "Tsummash-shalâtu ‘alan-Nabiyyi wa âlihi ۞ wa shaḫbihi wat-tâbi‘îna ûlil-karami",
                translation: "Kemudian limpahan shalawat semoga senantiasa tercurah kepada baginda Nabi, keluarganya, para sahabatnya, serta para tabi'in yang mulia."
            }
        ]
    }
];
