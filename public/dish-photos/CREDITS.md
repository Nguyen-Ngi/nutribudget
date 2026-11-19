# Dish imagery audit

**53 of 53 recipes have a distinct, local image.** The catalog uses 8 Wikimedia Commons photographs and 45 original ingredient illustrations. Every illustration is labeled **Minh họa** in the card.

The photo sources describe the dishes shown. Some photos depict the traditional presentation or garnishes of a simplified student recipe. The Hủ tiếu Nam Vang photo reviewed for this phase was not used for Hủ tiếu thịt bằm. The latter has its own illustration.

All images use a 640 × 400 canvas and the same crop ratio. Photographs use optimized JPEG or WebP. Original illustrations are rendered offline from the ingredients and shipped as WebP. Cards lazy-load assets from the application and provide a labeled fallback for a missing file.

The [asset manifest](../../src/data/meals/dishArt.json) records author, source, license, attribution requirements and image changes by stable recipe ID. Original illustrations are released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

## Photo credits

- **Thịt kho trứng** · `thit-kho-trung.webp` · Viethavvh, [Thịt kho Tàu.jpg](https://commons.wikimedia.org/wiki/File:Th%E1%BB%8Bt_kho_T%C3%A0u.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Cropped to 8:5, resized to 640×400, and converted to WebP. Credit author, link source and license, and disclose changes. Adaptation under the same license.
- **Rau muống xào tỏi** · `water-spinach.jpg` · Andy Wright, [Rau_muống_xào_tỏi.jpg](https://commons.wikimedia.org/wiki/File:Rau_mu%E1%BB%91ng_x%C3%A0o_t%E1%BB%8Fi.jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/). Web-sized and cropped by the display. See credits. Cropped to 8:5, resized to 640×400, and optimized for this catalog. Credit author, link source and license, disclose modifications.
- **Bún bò Huế** · `bun-bo-hue.jpg` · Alpha from Melbourne, Australia, [Bún_bò_Huế.jpg](https://commons.wikimedia.org/wiki/File:B%C3%BAn_b%C3%B2_Hu%E1%BA%BF.jpg), [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/). Web-sized and cropped by the display. See credits. Cropped to 8:5, resized to 640×400, and optimized for this catalog. Credit author, link source and license, disclose modifications. Modified image stays under the same license.
- **Bún riêu cua** · `bun-rieu.jpg` · Andy Li, [Crab_noodle_soup_-_Pho_2025-11-12.jpg](https://commons.wikimedia.org/wiki/File:Crab_noodle_soup_-_Pho_2025-11-12.jpg), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Web-sized and cropped by the display. See credits. Cropped to 8:5, resized to 640×400, and optimized for this catalog. Courtesy credit
- **Bò kho** · `bo-kho.jpg` · Jason Hutchens, [Kho.jpg](https://commons.wikimedia.org/wiki/File:Kho.jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/). Web-sized and cropped by the display. See credits. Cropped to 8:5, resized to 640×400, and optimized for this catalog. Credit author, link source and license, disclose modifications.
- **Phở gà** · `pho-ga.jpg` · Nguyen Thi Quynh Tram, [Pho_ga.png](https://commons.wikimedia.org/wiki/File:Pho_ga.png), [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Web-sized and cropped by the display. See credits. Cropped to 8:5, resized to 640×400, and optimized for this catalog. Credit author, link source and license, disclose modifications.
- **Bún thịt nướng** · `bun-thit-nuong.webp` · Takeaway, [Saigon Bun thit nuong.jpg](https://commons.wikimedia.org/wiki/File:Saigon_Bun_thit_nuong.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Cropped to 8:5, resized to 640×400, and converted to WebP. Credit author, link source and license, and disclose changes. Adaptation under the same license.
- **Canh chua cá** · `canh-chua-ca.webp` · Phương Huy, [Canh chua cá diêu hồng.jpg](https://commons.wikimedia.org/wiki/File:Canh_chua_c%C3%A1_di%C3%AAu_h%E1%BB%93ng.jpg), [Public domain (author dedication)](https://commons.wikimedia.org/wiki/File:Canh_chua_c%C3%A1_di%C3%AAu_h%E1%BB%93ng.jpg#Licensing). Cropped to 8:5, resized to 640×400, and converted to WebP. Courtesy credit

## Catalog inventory

| Recipe | Asset type | Local file |
| --- | --- | --- |
| Cháo gà | Illustration | `dish-illustrations/chao-ga.webp` |
| Bánh mì trứng ốp la | Illustration | `dish-illustrations/banh-mi-trung.webp` |
| Xôi đậu xanh | Illustration | `dish-illustrations/xoi-dau-xanh.webp` |
| Cháo bí đỏ đậu xanh | Illustration | `dish-illustrations/chao-bi-do.webp` |
| Bún xào đậu hũ | Illustration | `dish-illustrations/bun-xao-chay.webp` |
| Cơm trắng | Illustration | `dish-illustrations/com-trang.webp` |
| Cơm gạo lứt | Illustration | `dish-illustrations/com-gao-lut.webp` |
| Gà kho sả | Illustration | `dish-illustrations/ga-kho-sa.webp` |
| Thịt kho trứng | Photo | `dish-photos/thit-kho-trung.webp` |
| Đậu hũ sốt cà chua | Illustration | `dish-illustrations/dau-hu-sot-ca.webp` |
| Cá rô phi kho | Illustration | `dish-illustrations/ca-kho.webp` |
| Trứng chiên hành | Illustration | `dish-illustrations/trung-chien.webp` |
| Bò xào nấm | Illustration | `dish-illustrations/bo-xao.webp` |
| Tôm rim mặn ngọt | Illustration | `dish-illustrations/tom-rim.webp` |
| Đậu xanh kho nấm | Illustration | `dish-illustrations/dau-xanh-kho-nam.webp` |
| Rau muống xào tỏi | Photo | `dish-photos/water-spinach.jpg` |
| Bắp cải xào cà rốt | Illustration | `dish-illustrations/bap-cai-xao.webp` |
| Canh bí đỏ | Illustration | `dish-illustrations/canh-bi-do.webp` |
| Dưa leo trộn chanh | Illustration | `dish-illustrations/dua-leo-tron.webp` |
| Canh cà chua giá đỗ | Illustration | `dish-illustrations/canh-ca-chua.webp` |
| Nấm xào cà rốt | Illustration | `dish-illustrations/nam-xao.webp` |
| Hủ tiếu thịt bằm | Illustration | `dish-illustrations/hu-tieu.webp` |
| Bún bò Huế | Photo | `dish-photos/bun-bo-hue.jpg` |
| Bún riêu cua | Photo | `dish-photos/bun-rieu.jpg` |
| Bò kho | Photo | `dish-photos/bo-kho.jpg` |
| Phở gà | Photo | `dish-photos/pho-ga.jpg` |
| Bún thịt nướng | Photo | `dish-photos/bun-thit-nuong.webp` |
| Miến gà | Illustration | `dish-illustrations/mien-ga.webp` |
| Bánh canh tôm | Illustration | `dish-illustrations/banh-canh-tom.webp` |
| Bún cá cà chua | Illustration | `dish-illustrations/bun-ca.webp` |
| Mì xào bò | Illustration | `dish-illustrations/mi-xao-bo.webp` |
| Cơm chiên trứng | Illustration | `dish-illustrations/com-chien-trung.webp` |
| Cơm gà gừng | Illustration | `dish-illustrations/com-ga-gung.webp` |
| Cơm đậu xanh | Illustration | `dish-illustrations/com-dau-xanh.webp` |
| Cơm chiên cá mặn | Illustration | `dish-illustrations/com-chien-ca-man.webp` |
| Xôi mặn | Illustration | `dish-illustrations/xoi-man.webp` |
| Cháo thịt bằm | Illustration | `dish-illustrations/chao-thit-bam.webp` |
| Bánh mì gà xé | Illustration | `dish-illustrations/banh-mi-ga.webp` |
| Trứng hấp thịt | Illustration | `dish-illustrations/trung-hap.webp` |
| Thịt rim mặn ngọt | Illustration | `dish-illustrations/thit-rim.webp` |
| Gà kho gừng | Illustration | `dish-illustrations/ga-kho-gung.webp` |
| Cá chiên nước mắm | Illustration | `dish-illustrations/ca-chien.webp` |
| Tôm hấp sả | Illustration | `dish-illustrations/tom-hap.webp` |
| Đậu hũ chiên sả | Illustration | `dish-illustrations/dau-hu-chien-sa.webp` |
| Thịt luộc | Illustration | `dish-illustrations/thit-luoc.webp` |
| Cá hấp gừng | Illustration | `dish-illustrations/ca-hap-gung.webp` |
| Canh chua cá | Photo | `dish-photos/canh-chua-ca.webp` |
| Canh cải thịt bằm | Illustration | `dish-illustrations/canh-cai-thit.webp` |
| Canh trứng cà chua | Illustration | `dish-illustrations/canh-trung-ca-chua.webp` |
| Canh bí đỏ nấu tôm | Illustration | `dish-illustrations/canh-bi-nau-tom.webp` |
| Giá xào hành | Illustration | `dish-illustrations/gia-xao-he.webp` |
| Rau muống luộc | Illustration | `dish-illustrations/rau-muong-luoc.webp` |
| Cà rốt xào trứng | Illustration | `dish-illustrations/ca-rot-xao-trung.webp` |
