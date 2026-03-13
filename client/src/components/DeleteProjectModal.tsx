import React from 'react';
import { Trash2 } from 'lucide-react';

interface DeleteProjectModalProps {
    projectToDelete: string | null;
    setProjectToDelete: (id: string | null) => void;
    deleteProject: (id: string) => void;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
    projectToDelete,
    setProjectToDelete,
    deleteProject
}) => {
    if (!projectToDelete) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setProjectToDelete(null)}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm m-4 border border-slate-200" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Project?</h3>
                    <div className="flex gap-3 w-full">
                        <button onClick={() => setProjectToDelete(null)} className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg">Cancel</button>
                        <button onClick={() => projectToDelete && deleteProject(projectToDelete)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">Delete</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
