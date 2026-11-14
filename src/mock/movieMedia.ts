export interface MovieMedia {
  posterUrl: string;
  backdropUrl: string;
  trailerId?: string;
}

/**
 * Poster/backdrop/trailer cho các phim có dữ liệu thật.
 * Ảnh được lưu cục bộ trong `public/` để không phụ thuộc mạng/CDN bên ngoài.
 */
export const MOVIE_MEDIA: Record<string, MovieMedia> = {
  'hai-phuong': {
    posterUrl: '/posters/hai-phuong.jpg',
    backdropUrl: '/backdrops/hai-phuong.jpg',
    trailerId: 'SXiWz0yLLdE',
  },
  'dao-pho-va-piano': {
    posterUrl: '/posters/dao-pho-va-piano.jpg',
    backdropUrl: '/backdrops/dao-pho-va-piano.jpg',
    trailerId: 'qn1t_biQigc',
  },
  mai: {
    posterUrl: '/posters/mai.jpg',
    backdropUrl: '/backdrops/mai.jpg',
    trailerId: 'HXWRTGbhb4U',
  },
  'lat-mat-7-mot-dieu-uoc': {
    posterUrl: '/posters/lat-mat-7-mot-dieu-uoc.jpg',
    backdropUrl: '/backdrops/lat-mat-7-mot-dieu-uoc.jpg',
    trailerId: 'QdtPQ0wV53M',
  },
  'trang-ti-phieu-luu-ky': {
    posterUrl: '/posters/trang-ti-phieu-luu-ky.jpg',
    backdropUrl: '/backdrops/trang-ti-phieu-luu-ky.jpg',
    trailerId: '3aW_ofzDiZo',
  },
  'chuyen-ma-gan-nha': {
    posterUrl: '/posters/chuyen-ma-gan-nha.jpg',
    backdropUrl: '/backdrops/chuyen-ma-gan-nha.jpg',
    trailerId: 'XveLprAPXoE',
  },
  'loi-bao': {
    posterUrl: '/posters/loi-bao.jpg',
    backdropUrl: '/backdrops/loi-bao.jpg',
    trailerId: 'f_pmSmrR0VU',
  },
  'wolfoo-hon-dao-ky-bi': {
    posterUrl: '/posters/wolfoo-hon-dao-ky-bi.jpg',
    backdropUrl: '/backdrops/wolfoo-hon-dao-ky-bi.jpg',
    trailerId: 'JBh7SlUwPUg',
  },
  'nha-ba-nu': {
    posterUrl: '/posters/nha-ba-nu.jpg',
    backdropUrl: '/backdrops/nha-ba-nu.jpg',
    trailerId: 'IkaP0KJWTsQ',
  },
  'mat-biec': {
    posterUrl: '/posters/mat-biec.jpg',
    backdropUrl: '/backdrops/mat-biec.jpg',
    trailerId: 'ITlQ0oU7tDA',
  },
  'bo-gia': {
    posterUrl: '/posters/bo-gia.jpg',
    backdropUrl: '/backdrops/bo-gia.jpg',
    trailerId: 'jluSu8Rw6YE',
  },
  'linh-mieu-quy-nhap-trang': {
    posterUrl: '/posters/linh-mieu.jpg',
    backdropUrl: '/backdrops/linh-mieu.jpg',
    trailerId: '8l4crgVt36Y',
  },
  'quy-cau': {
    posterUrl: '/posters/quy-cau.jpg',
    backdropUrl: '/backdrops/quy-cau.jpg',
    trailerId: 'MV4XLx_Vzw0',
  },
  'song-lang': {
    posterUrl: '/posters/song-lang.jpg',
    backdropUrl: '/backdrops/song-lang.jpg',
    trailerId: 'wX8nGJFGwaU',
  },
  'nguoi-vo-cuoi-cung': {
    posterUrl: '/posters/nguoi-vo-cuoi-cung.jpg',
    backdropUrl: '/backdrops/nguoi-vo-cuoi-cung.jpg',
    trailerId: 'cpAESa3yUyw',
  },
  'em-chua-18': {
    posterUrl: '/posters/em-chua-18.jpg',
    backdropUrl: '/backdrops/em-chua-18.jpg',
    trailerId: '_affkHceSj4',
  },
  'tro-tan-ruc-ro': {
    posterUrl: '/posters/tro-tan-ruc-ro.jpg',
    backdropUrl: '/backdrops/tro-tan-ruc-ro.jpg',
    trailerId: 'Sx0gdaeeGi4',
  },
  sut: {
    posterUrl: '/posters/sut.jpg',
    backdropUrl: '/backdrops/sut.jpg',
    trailerId: 'dqmXjR0tZfI',
  },
  'em-va-trinh': {
    posterUrl: '/posters/em-va-trinh.jpg',
    backdropUrl: '/backdrops/em-va-trinh.jpg',
    trailerId: 'IosqnBOkk2I',
  },
  'mui-co-chay': {
    posterUrl: '/posters/mui-co-chay.jpg',
    backdropUrl: '/backdrops/mui-co-chay.jpg',
    trailerId: 'Up9T0jRpBOA',
  },
  'truy-sat': {
    posterUrl: '/posters/truy-sat.jpg',
    backdropUrl: '/backdrops/truy-sat.jpg',
    trailerId: 'sAibeuzwd_o',
  },
  'nguoi-bat-tu': {
    posterUrl: '/posters/nguoi-bat-tu.jpg',
    backdropUrl: '/backdrops/nguoi-bat-tu.jpg',
    trailerId: '6VEVPtFDN_U',
  },
  'qua-tim-mau': {
    posterUrl: '/posters/qua-tim-mau.jpg',
    backdropUrl: '/backdrops/qua-tim-mau.jpg',
    trailerId: 'eFUOOcTZI_4',
  },
  'chi-muoi-ba': {
    posterUrl: '/posters/chi-muoi-ba.jpg',
    backdropUrl: '/backdrops/chi-muoi-ba.jpg',
    trailerId: 'Ncwkodt5dA4',
  },
  'de-men': {
    posterUrl: '/posters/de-men.jpg',
    backdropUrl: '/backdrops/de-men.jpg',
    trailerId: 'Vwwsh0QxwIs',
  },
  'trang-quynh-nhi': {
    posterUrl: '/posters/trang-quynh-nhi.jpg',
    backdropUrl: '/backdrops/trang-quynh-nhi.jpg',
    trailerId: 'YQdA6Ou4xZk',
  },

  'toi-thay-hoa-vang': {
    posterUrl: '/posters/toi-thay-hoa-vang.jpg',
    backdropUrl: '/backdrops/toi-thay-hoa-vang.jpg',
    trailerId: 'wmjiCP6R-7I',
  },
  'dat-rung-phuong-nam': {
    posterUrl: '/posters/dat-rung-phuong-nam.jpg',
    backdropUrl: '/backdrops/dat-rung-phuong-nam.jpg',
    trailerId: 'hktzirCnJmQ',
  },
  'tam-cam': {
    posterUrl: '/posters/tam-cam.jpg',
    backdropUrl: '/backdrops/tam-cam.jpg',
    trailerId: '6oqXSG5FKd4',
  },
  'thien-menh-anh-hung': {
    posterUrl: '/posters/thien-menh-anh-hung.jpg',
    backdropUrl: '/backdrops/thien-menh-anh-hung.jpg',
    trailerId: 'kiTeyH3xASE',
  },
  'bui-doi-cho-lon': {
    posterUrl: '/posters/bui-doi-cho-lon.jpg',
    backdropUrl: '/backdrops/bui-doi-cho-lon.jpg',
    trailerId: 'b9pw1sdwyYs',
  },
  've-si-sai-gon': {
    posterUrl: '/posters/ve-si-sai-gon.jpg',
    backdropUrl: '/backdrops/ve-si-sai-gon.jpg',
    trailerId: 'faZhrk93yW0',
  },
  'gai-gia-lam-chieu-v': {
    posterUrl: '/posters/gai-gia-lam-chieu-v.jpg',
    backdropUrl: '/backdrops/gai-gia-lam-chieu-v.jpg',
    trailerId: 'IxfeXhGAa9M',
  },
  'cua-lai-vo-bau': {
    posterUrl: '/posters/cua-lai-vo-bau.jpg',
    backdropUrl: '/backdrops/cua-lai-vo-bau.jpg',
    trailerId: 'l8vTMxuvz6Y',
  },
  'chi-chi-em-em': {
    posterUrl: '/posters/chi-chi-em-em.jpg',
    backdropUrl: '/backdrops/chi-chi-em-em.jpg',
    trailerId: 'Z73wnPtHdEg',
  },
  'co-ba-sai-gon': {
    posterUrl: '/posters/co-ba-sai-gon.jpg',
    backdropUrl: '/backdrops/co-ba-sai-gon.jpg',
    trailerId: 'YP4TDQVkZO4',
  },
  'yeu': {
    posterUrl: '/posters/yeu.jpg',
    backdropUrl: '/backdrops/yeu.jpg',
    trailerId: 'bh-WIE0Lo9w',
  },
  'ma-da': {
    posterUrl: '/posters/ma-da.jpg',
    backdropUrl: '/backdrops/ma-da.jpg',
    trailerId: 'ocWpaBmLy3I',
  },
  'ke-an-hon': {
    posterUrl: '/posters/ke-an-hon.jpg',
    backdropUrl: '/backdrops/ke-an-hon.jpg',
    trailerId: 'PqGn9wWjoUk',
  },
  'cam': {
    posterUrl: '/posters/cam.jpg',
    backdropUrl: '/backdrops/cam.jpg',
    trailerId: '_8qUFEmPQbc',
  },
  'nha-gia-tien': {
    posterUrl: '/posters/nha-gia-tien.jpg',
    backdropUrl: '/backdrops/nha-gia-tien.jpg',
    trailerId: 'hXGozmNBwt4',
  },
  'bo-tu-bao-thu': {
    posterUrl: '/posters/bo-tu-bao-thu.jpg',
    backdropUrl: '/backdrops/bo-tu-bao-thu.jpg',
    trailerId: 'zKMOgOWn8lQ',
  },
};
