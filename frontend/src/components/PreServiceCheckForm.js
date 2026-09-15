import { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Camera, Upload, X, Plus, Trash2 } from 'lucide-react';

const STATUS_BUTTONS = [
  { value: 'satisfactory', label: 'OK', active: 'bg-green-600 hover:bg-green-700 text-white', idle: 'hover:bg-green-50 text-green-700 border-green-300' },
  { value: 'unsatisfactory', label: 'Needs Work', active: 'bg-red-600 hover:bg-red-700 text-white', idle: 'hover:bg-red-50 text-red-600 border-red-300' },
  { value: 'n/a', label: 'N/A', active: 'bg-gray-600 hover:bg-gray-700 text-white', idle: 'hover:bg-gray-50 text-gray-600' },
];

const PhotoRow = ({ photos, onTake, onUpload, onDelete, testId }) => (
  <div className="mt-2 space-y-2">
    <div className="flex items-center flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={onTake} className="text-xs" data-testid={`${testId}-take-photo`}>
        <Camera className="h-3 w-3 mr-1" /> Take Photo
      </Button>
      <Button variant="outline" size="sm" onClick={onUpload} className="text-xs" data-testid={`${testId}-upload-photo`}>
        <Upload className="h-3 w-3 mr-1" /> Upload Photo
      </Button>
      {photos?.length > 0 && (
        <span className="text-xs text-green-600 font-medium">✓ {photos.length} photo{photos.length > 1 ? 's' : ''}</span>
      )}
    </div>
    {photos?.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative">
            <img src={photo.data} alt="Service check photo" className="w-16 h-16 object-cover rounded border" />
            <Button variant="destructive" size="sm" className="absolute -top-1 -right-1 w-5 h-5 p-0 rounded-full" onClick={() => onDelete(photo.id)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    )}
  </div>
);

const SectionCard = ({ item, index, onItemChange, onRemove, takePhoto, uploadPhoto, deletePhoto }) => (
  <Card className={`p-4 ${item.status === 'unsatisfactory' ? 'border-l-4 border-l-red-500 bg-red-50/30' : item.status === 'satisfactory' ? 'border-l-4 border-l-green-500' : ''}`} data-testid={`service-section-${index}`}>
    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1 flex items-start gap-2">
        {item.custom && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0" onClick={onRemove} title="Remove this part / area" data-testid={`service-section-${index}-remove`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <div>
          <p className={`text-base font-semibold ${item.status === 'unsatisfactory' ? 'text-red-700' : item.status === 'n/a' ? 'text-gray-500' : 'text-gray-900'}`}>{item.item}</p>
          {item.status === 'unsatisfactory' && <p className="mt-1 text-xs text-red-600 font-medium">⚠ Needs work - describe what is required below</p>}
          {item.status === 'n/a' && <p className="mt-1 text-xs text-gray-500 font-medium">ℹ Not Applicable</p>}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {STATUS_BUTTONS.map(({ value, label, active, idle }) => (
          <Button
            key={value}
            variant="outline"
            size="sm"
            className={`px-3 h-9 text-xs font-semibold ${item.status === value ? active : idle}`}
            onClick={() => onItemChange(index, 'status', item.status === value ? 'unchecked' : value)}
            data-testid={`service-section-${index}-${value === 'n/a' ? 'na' : value}`}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
    <PhotoRow
      photos={item.photos}
      onTake={() => takePhoto(index)}
      onUpload={() => uploadPhoto(index)}
      onDelete={(photoId) => deletePhoto(index, photoId)}
      testId={`service-section-${index}`}
    />
    <Textarea
      placeholder={item.status === 'unsatisfactory' ? 'REQUIRED: Describe the work needed' : 'Notes (optional)'}
      value={item.notes}
      onChange={(e) => onItemChange(index, 'notes', e.target.value)}
      className={`mt-2 text-sm ${item.status === 'unsatisfactory' ? 'border-red-300 bg-red-50' : ''}`}
      rows={2}
      data-testid={`service-section-${index}-notes`}
    />
    {item.status === 'unsatisfactory' && !item.notes?.trim() && (
      <div className="mt-1 text-xs text-red-600 font-medium">⚠ Description of work needed is required</div>
    )}
  </Card>
);

const AddSectionRow = ({ onAdd, generic }) => {
  const [value, setValue] = useState('');
  const submit = () => { onAdd(value); setValue(''); };
  return (
    <Card className={`p-4 border-dashed ${generic ? 'border-purple-300 bg-purple-50/30' : 'border-gray-300'}`} data-testid="add-service-section-card">
      <label className="text-sm font-medium block mb-1">{generic ? 'Add a part / area you checked' : 'Add another part / area (optional)'}</label>
      <div className="flex gap-2">
        <Input
          placeholder="e.g. Gearbox, Hydraulic hoses, Main bearing"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          data-testid="add-service-section-input"
        />
        <Button type="button" variant="outline" onClick={submit} disabled={!value.trim()} data-testid="add-service-section-btn">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
    </Card>
  );
};

const PartsRequiredList = ({ partsRequired, setPartsRequired, partInput, setPartInput, addPart }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium block">Parts required (name + part number)</label>
    <div className="flex gap-2">
      <Input
        placeholder="e.g. Gun carriage tyre 10.0/75-15.3 — part no. 12345"
        value={partInput}
        onChange={(e) => setPartInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPart(); } }}
        data-testid="parts-required-input"
      />
      <Button type="button" variant="outline" onClick={addPart} disabled={!partInput.trim()} data-testid="parts-required-add-btn">
        <Plus className="h-4 w-4 mr-1" /> Add
      </Button>
    </div>
    {partsRequired.length > 0 && (
      <ul className="divide-y rounded border bg-white" data-testid="parts-required-list">
        {partsRequired.map((part, i) => (
          <li key={`${part}-${i}`} className="flex items-center justify-between px-3 py-2 text-sm" data-testid={`parts-required-item-${i}`}>
            <span>{i + 1}. {part}</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:bg-red-50" onClick={() => setPartsRequired(prev => prev.filter((_, idx) => idx !== i))} data-testid={`parts-required-remove-${i}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const Intro = ({ template }) => (
  <div>
    <h3 className="text-lg font-semibold">{template.name}</h3>
    {template.generic ? (
      <p className="text-sm text-gray-600" data-testid="generic-service-intro">
        There is no set service sheet for this machine type, so work around the <span className="font-semibold">whole machine</span>: add each part or area you check, mark it <span className="font-semibold text-green-700">OK</span>, <span className="font-semibold text-red-600">Needs Work</span> or <span className="font-semibold text-gray-600">N/A</span>, take photos of any issues, and list the part numbers needed for replacements below.
      </p>
    ) : (
      <p className="text-sm text-gray-600">Go through each section of the machine. Mark it <span className="font-semibold text-green-700">OK</span>, <span className="font-semibold text-red-600">Needs Work</span> or <span className="font-semibold text-gray-600">N/A</span>, then add notes and photos where useful.</p>
    )}
  </div>
);

export const PreServiceCheckForm = ({
  template, items, onItemChange, onAddSection, onRemoveSection, takePhoto, uploadPhoto, deletePhoto,
  notes, setNotes, photos, partsRequired, setPartsRequired, partInput, setPartInput, addPart,
}) => (
  <div className="space-y-4" data-testid="pre-service-check-form">
    <Intro template={template} />
    {items.map((item, index) => (
      <SectionCard key={item.item} item={item} index={index} onItemChange={onItemChange} onRemove={() => onRemoveSection(index)} takePhoto={takePhoto} uploadPhoto={uploadPhoto} deletePhoto={deletePhoto} />
    ))}
    <AddSectionRow onAdd={onAddSection} generic={template.generic} />
    <Card className="p-4 border-purple-200 bg-purple-50/40" data-testid="other-parts-issues-card">
      <h4 className="text-base font-semibold text-purple-900">Any other Parts or Issues</h4>
      <p className="text-xs text-gray-600 mb-3">Anything not covered above, photos of issues across the machine, plus the parts that need ordering.</p>
      <Textarea
        placeholder="Describe any other issues found on this machine..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="min-h-[90px] bg-white"
        data-testid="other-issues-notes-input"
      />
      <PhotoRow
        photos={photos}
        onTake={() => takePhoto(-1)}
        onUpload={() => uploadPhoto(-1)}
        onDelete={(photoId) => deletePhoto(-1, photoId)}
        testId="other-issues"
      />
      <div className="mt-4">
        <PartsRequiredList partsRequired={partsRequired} setPartsRequired={setPartsRequired} partInput={partInput} setPartInput={setPartInput} addPart={addPart} />
      </div>
    </Card>
  </div>
);
