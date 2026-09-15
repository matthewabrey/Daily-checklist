// Renders checklist / workshop photos; list responses omit the image data until the full record loads
export const ChecklistPhotos = ({ photos = [], alt = 'Photo', imgClassName = 'w-full h-24 object-cover rounded', gridClassName = 'mt-3 grid grid-cols-3 gap-2', onPhotoClick }) => {
  const ready = photos.filter(p => p && p.data);
  const pending = photos.length - ready.length;
  return (
    <>
      {pending > 0 && (
        <p className="mt-2 text-xs text-gray-500 italic" data-testid="photos-loading">
          Loading {pending} photo{pending > 1 ? 's' : ''}…
        </p>
      )}
      {ready.length > 0 && (
        <div className={gridClassName}>
          {ready.map((photo, index) => (
            <img
              key={photo.id || index}
              src={photo.data}
              alt={`${alt} ${index + 1}`}
              loading="lazy"
              className={`${imgClassName}${onPhotoClick ? ' cursor-pointer hover:opacity-75' : ''}`}
              onClick={onPhotoClick ? (e) => { e.stopPropagation(); onPhotoClick(photo, index, ready); } : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
};
