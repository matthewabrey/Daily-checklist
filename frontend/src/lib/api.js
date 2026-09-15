export const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

// List endpoints omit photo binaries for speed; fetch the full record (with photos) on demand
export const fetchChecklistDetail = async (id) => {
  const response = await fetch(`${API_BASE_URL}/api/checklists/${id}`);
  return response.ok ? response.json() : null;
};

export const hasMissingPhotoData = (checklist) => {
  if (!checklist) return false;
  const itemPhotos = (checklist.checklist_items || []).flatMap(i => i.photos || []);
  return [...itemPhotos, ...(checklist.workshop_photos || [])].some(p => !p.data);
};
