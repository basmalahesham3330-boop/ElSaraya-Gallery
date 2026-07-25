import { memo, useState } from 'react';
import { Edit, Save } from 'lucide-react';
import type { Job } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import Button from '../Button';
import CollapsibleSection from '../CollapsibleSection';

interface ProjectNotesProps {
  job: Job;
  onSave: (notes: string) => void;
}

const ProjectNotes = memo(function ProjectNotes({ job, onSave }: ProjectNotesProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');

  const handleStartEdit = () => {
    setEditedNotes(job.notes || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    onSave(editedNotes);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedNotes('');
  };

  return (
    <CollapsibleSection
      title={t('projects.notes')}
      defaultOpen={true}
      headerActions={
        !isEditing ? (
          <Button size="sm" variant="outline" onClick={handleStartEdit} className="flex items-center gap-2">
            <Edit className="w-4 h-4" />
            {t('common.edit')}
          </Button>
        ) : undefined
      }
    >
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editedNotes}
            onChange={(e) => setEditedNotes(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder={t('projects.addNotes')}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              {t('common.save')}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {job.notes ? (
            <p className="text-gray-700 whitespace-pre-wrap">{job.notes}</p>
          ) : (
            <p className="text-gray-500 italic">{t('projects.noNotes')}</p>
          )}
        </>
      )}
    </CollapsibleSection>
  );
});

export default ProjectNotes;
