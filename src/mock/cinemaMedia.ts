export interface CinemaMedia {
  imageUrl: string;
}

/**
 * Ảnh minh hoạ cho các cụm rạp.
 * Ảnh lưu cục bộ trong `public/cinemas/` để không phụ thuộc CDN bên ngoài.
 */
export const CINEMA_MEDIA: Record<string, CinemaMedia> = {
  'PXU Cinema Landmark': { imageUrl: '/cinemas/landmark.jpg' },
  'PXU Cinema Royal City': { imageUrl: '/cinemas/royal-city.jpg' },
  'PXU Cinema Huế': { imageUrl: '/cinemas/hue.jpg' },
};
