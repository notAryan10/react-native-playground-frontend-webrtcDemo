'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FileText, Folder, Plus, Trash2, Package, X, ChevronRight, ChevronDown, Search } from 'lucide-react';

export interface File {
    name: string;
    content: string;
    language: string;
}

interface FileExplorerProps {
    files: Record<string, File>;
    activeFile: string;
    onFileSelect: (fileName: string) => void;
    onCreateFile: (fileName: string) => void;
    onDeleteFile: (fileName: string) => void;
    dependencies: Record<string, string>;
    onAddDependency: (name: string, version: string) => void;
    onRemoveDependency: (name: string) => void;
}

type FileNode = {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: FileNode[];
};

const buildFileTree = (files: Record<string, File>): FileNode[] => {
    const root: FileNode[] = [];

    Object.keys(files).forEach(path => {
        const parts = path.split('/');
        let currentLevel = root;

        parts.forEach((part, index) => {
            const isFile = index === parts.length - 1;
            const existingNode = currentLevel.find(node => node.name === part);

            if (existingNode) {
                if (!isFile && existingNode.children) {
                    currentLevel = existingNode.children;
                }
            } else {
                const newNode: FileNode = {
                    name: part,
                    path: parts.slice(0, index + 1).join('/'),
                    type: isFile ? 'file' : 'folder',
                    children: isFile ? undefined : []
                };
                currentLevel.push(newNode);
                if (!isFile && newNode.children) {
                    currentLevel = newNode.children;
                }
            }
        });
    });

    const sortNodes = (nodes: FileNode[]) => {
        nodes.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });
        nodes.forEach(node => {
            if (node.children) sortNodes(node.children);
        });
    };

    sortNodes(root);
    return root;
};

export const FileExplorer: React.FC<FileExplorerProps> = ({
    files,
    activeFile,
    onFileSelect,
    onCreateFile,
    onDeleteFile,
    dependencies,
    onAddDependency,
    onRemoveDependency
}) => {
    const [fileTree, setFileTree] = useState<FileNode[]>([]);
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ 'src': true, 'public': true });
    const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
    const [newItemName, setNewItemName] = useState('');
    const [selectedFolder, setSelectedFolder] = useState<string>(''); 

    const [depQuery, setDepQuery] = useState('');
    const [depSuggestions, setDepSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        setFileTree(buildFileTree(files));
    }, [files]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (depQuery.length > 1) {
                const res = await fetch(`${process.env.NEXT_PUBLIC_NPMS_API || ''}?q=${depQuery}`);
                const data = await res.json();
                setDepSuggestions(data);
            } else {

                    setShowSuggestions(true);
                } catch (e) {
                    console.error("Failed to fetch deps", e);
                }
            } else {
                setDepSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [depQuery]);

    const toggleFolder = (path: string) => {
        setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName.trim()) return;

        let path = selectedFolder ? `${selectedFolder}/${newItemName}` : newItemName;

        if (isCreating === 'file') {
            if (!path.includes('.')) path += '.tsx'; 
            onCreateFile(path);
        } else {
            onCreateFile(`${path}/.keep`);
        }

        setNewItemName('');
        setIsCreating(null);
    };

    const renderNode = (node: FileNode, depth: number = 0) => {
        const isExpanded = expandedFolders[node.path];
        const isActive = activeFile === node.path;
        const paddingLeft = `${depth * 12 + 8}px`;

        return (
            <div key={node.path}>
                <div
                    className={`flex items-center gap-1.5 py-1 text-sm cursor-pointer select-none group
            ${isActive ? 'bg-[#37373d] text-white' : 'text-gray-400 hover:text-gray-300 hover:bg-[#2a2d2e]'}`}
                    style={{ paddingLeft }}
                    onClick={() => {
                        if (node.type === 'folder') {
                            toggleFolder(node.path);
                            setSelectedFolder(node.path);
                        } else {
                            onFileSelect(node.path);
                        }
                    }}>
                    <span className="opacity-70">
                        {node.type === 'folder' ? (
                            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        ) : <div className="w-3.5" />}
                    </span>

                    {node.type === 'folder' ? (
                        <Folder size={14} className={isActive ? 'text-white' : 'text-blue-400'} />
                    ) : (
                        <FileText size={14} className={isActive ? 'text-blue-400' : 'text-gray-400'} />
                    )}

                    <span className="truncate flex-1">{node.name}</span>

                    {node.type === 'file' && node.name !== 'App.tsx' && (
                        <button onClick={(e) => { e.stopPropagation(); onDeleteFile(node.path); }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-red-500 rounded mr-1">
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>

                {node.type === 'folder' && isExpanded && node.children && (
                    <div>
                        {node.children.map(child => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] border-r border-[#3e3e42]">
            <div className="flex items-center justify-between px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span>Files</span>
                <div className="flex gap-1">
                    <button onClick={() => { setIsCreating('file'); setSelectedFolder(''); }}
                        className="p-1 hover:bg-[#3e3e42] rounded text-gray-300"
                        title="New File">
                        <FileText size={14} />
                    </button>
                    <button onClick={() => { setIsCreating('folder'); setSelectedFolder(''); }}
                        className="p-1 hover:bg-[#3e3e42] rounded text-gray-300"
                        title="New Folder">
                        <Folder size={14} />
                    </button>
                </div>
            </div>

            {isCreating && (
                <form onSubmit={handleCreateSubmit} className="px-2 mb-2">
                    <div className="text-[10px] text-gray-500 mb-1 ml-1">
                        Creating {isCreating} in {selectedFolder || '/'}
                    </div>
                    <div className="flex items-center gap-1 bg-[#3c3c3c] rounded px-2 py-1 border border-blue-500">
                        {isCreating === 'folder' ? <Folder size={12} /> : <FileText size={12} />}
                        <input
                            autoFocus
                            className="bg-transparent text-white text-xs outline-none w-full placeholder-gray-500"
                            placeholder="Name..."
                            value={newItemName}
                            onChange={e => setNewItemName(e.target.value)}
                            onBlur={() => !newItemName && setIsCreating(null)}
                        />
                    </div>
                </form>
            )}

            <div className="flex-1 overflow-y-auto">
                {fileTree.map(node => renderNode(node))}
            </div>

            <div className="border-t border-[#3e3e42] flex flex-col h-1/3 min-h-[150px]">
                <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-[#252526]">
                    Dependencies
                </div>

                <div className="px-2 py-2 border-b border-[#3e3e42] relative">
                    <div className="flex items-center bg-[#3c3c3c] rounded px-2 py-1">
                        <Search size={12} className="text-gray-500 mr-2" />
                        <input
                            className="bg-transparent text-white text-xs outline-none w-full placeholder-gray-500"
                            placeholder="Add dependency..."
                            value={depQuery}
                            onChange={e => setDepQuery(e.target.value)}/>
                    </div>

                    {showSuggestions && depSuggestions.length > 0 && (
                        <div className="absolute left-2 right-2 top-full mt-1 bg-[#252526] border border-[#3e3e42] rounded shadow-xl z-50 max-h-40 overflow-y-auto">
                            {depSuggestions.map((item: any) => (
                                <div
                                    key={item.package.name}
                                    className="px-3 py-2 hover:bg-[#2a2d2e] cursor-pointer flex justify-between items-center group"
                                    onClick={() => {
                                        onAddDependency(item.package.name, item.package.version);
                                        setDepQuery('');
                                        setShowSuggestions(false);
                                    }}>
                                    <div>
                                        <div className="text-xs text-white font-medium">{item.package.name}</div>
                                        <div className="text-[10px] text-gray-500">{item.package.description?.slice(0, 30)}...</div>
                                    </div>
                                    <Plus size={12} className="text-blue-400 opacity-0 group-hover:opacity-100" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {Object.entries(dependencies).map(([name, version]) => (
                        <div key={name} className="flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2d2e] group">
                            <div className="flex items-center gap-2">
                                <Package size={14} className="text-purple-400" />
                                <div className="flex flex-col">
                                    <span className="text-xs text-gray-300">{name}</span>
                                    <span className="text-[10px] text-gray-500">{version}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => onRemoveDependency(name)}
                                className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-gray-500"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
