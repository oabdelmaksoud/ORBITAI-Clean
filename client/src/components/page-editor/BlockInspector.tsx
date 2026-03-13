import React from 'react';
import { useEditor } from '@craftjs/core';
import { getBlockSchema } from './blocks/registry';
import { BlockType } from '@orbitai/shared';

export function BlockInspector() {
  const { selected, actions, query } = useEditor((state, query) => {
    const currentlySelectedNodeId = query.getEvent('selected').last();
    let selected;

    if (currentlySelectedNodeId) {
      selected = {
        id: currentlySelectedNodeId,
        name: state.nodes[currentlySelectedNodeId].data.name,
        settings: state.nodes[currentlySelectedNodeId].related?.settings,
        isDeletable: query.node(currentlySelectedNodeId).isDeletable(),
        props: state.nodes[currentlySelectedNodeId].data.props
      };
    }

    return {
      selected
    };
  });

  if (!selected) {
    return (
      <div className="w-80 bg-white border-l border-slate-200 p-4">
        <p className="text-sm text-slate-500">Select a block to edit</p>
      </div>
    );
  }

  const blockSchema = getBlockSchema(selected.name as BlockType);

  const handlePropChange = (propName: string, value: any) => {
    actions.setProp(selected.id, (props: any) => {
      props[propName] = value;
    });
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">{blockSchema?.label || selected.name}</h3>
          {selected.isDeletable && (
            <button
              onClick={() => actions.delete(selected.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Delete
            </button>
          )}
        </div>

        {blockSchema && (
          <div className="space-y-4">
            {Object.entries(blockSchema.schema).map(([propName, fieldSchema]) => (
              <div key={propName}>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {fieldSchema.label || propName}
                </label>
                {fieldSchema.type === 'text' && (
                  <input
                    type="text"
                    value={selected.props[propName] || fieldSchema.defaultValue || ''}
                    onChange={(e) => handlePropChange(propName, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder={fieldSchema.placeholder}
                  />
                )}
                {fieldSchema.type === 'richText' && (
                  <textarea
                    value={selected.props[propName] || fieldSchema.defaultValue || ''}
                    onChange={(e) => handlePropChange(propName, e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder={fieldSchema.placeholder}
                  />
                )}
                {fieldSchema.type === 'number' && (
                  <input
                    type="number"
                    value={selected.props[propName] ?? fieldSchema.defaultValue ?? 0}
                    onChange={(e) => handlePropChange(propName, Number(e.target.value))}
                    min={fieldSchema.min}
                    max={fieldSchema.max}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                )}
                {fieldSchema.type === 'boolean' && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.props[propName] ?? fieldSchema.defaultValue ?? false}
                      onChange={(e) => handlePropChange(propName, e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-600">Enabled</span>
                  </label>
                )}
                {fieldSchema.type === 'select' && (
                  <select
                    value={selected.props[propName] ?? fieldSchema.defaultValue ?? ''}
                    onChange={(e) => handlePropChange(propName, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {fieldSchema.options?.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                )}
                {fieldSchema.type === 'color' && (
                  <input
                    type="color"
                    value={selected.props[propName] || fieldSchema.defaultValue || '#000000'}
                    onChange={(e) => handlePropChange(propName, e.target.value)}
                    className="w-full h-10 border border-slate-300 rounded-lg"
                  />
                )}
                {fieldSchema.type === 'url' && (
                  <input
                    type="url"
                    value={selected.props[propName] || fieldSchema.defaultValue || ''}
                    onChange={(e) => handlePropChange(propName, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder={fieldSchema.placeholder || 'https://...'}
                  />
                )}
                {fieldSchema.description && (
                  <p className="text-xs text-slate-500 mt-1">{fieldSchema.description}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {selected.settings && React.createElement(selected.settings)}
      </div>
    </div>
  );
}




