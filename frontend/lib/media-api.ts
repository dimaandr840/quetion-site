import { apiFetch, apiUpload } from "./api";

/**
 * Загрузка картинок для админки.
 *
 * Файл уезжает в хранилище сразу, до сохранения вопроса: так получается показать превью
 * и сразу сообщить об ошибке формата, не заставляя заполнять всю форму. Плата за это —
 * возможные объекты-сироты, если админ закроет окно; их по ночам чистит MediaMaintenanceJob.
 */
export interface MediaUploadResponse {
  storageKey: string;
  url: string;
  contentType: string;
  width: number;
  height: number;
  byteSize: number;
}

export async function uploadQuestionImage(
  file: File
): Promise<MediaUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<MediaUploadResponse>("/admin/media", formData);
}

/**
 * Удаление файла из хранилища. Нужно только для только что загруженной и тут же убранной
 * картинки: уже сохранённые файлы удаляет бэкенд при апсерте вопроса.
 */
export async function deleteMedia(storageKey: string): Promise<void> {
  await apiFetch<void>(`/admin/media?key=${encodeURIComponent(storageKey)}`, {
    method: "DELETE",
  });
}
