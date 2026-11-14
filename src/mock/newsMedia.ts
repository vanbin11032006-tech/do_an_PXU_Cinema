export interface NewsMedia {
  imageUrl: string;
}

/**
 * Ảnh minh hoạ cho các bài tin tức/khuyến mãi.
 * Ảnh lưu cục bộ trong `public/news/` để không phụ thuộc CDN bên ngoài.
 */
export const NEWS_MEDIA: Record<string, NewsMedia> = {
  'ra-mat-phong-gold-class': { imageUrl: '/news/gold-class.jpg' },
  'uu-dai-50k-thanh-vien': { imageUrl: '/news/uu-dai-50k.jpg' },
  'huong-dan-nhan-bap-nuoc': { imageUrl: '/news/combo-bap-nuoc.jpg' },
};
