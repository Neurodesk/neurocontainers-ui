import {
    ChevronDownIcon,
    ChevronRightIcon,
    TrashIcon,
    Bars3Icon,
    ChevronUpIcon,
    ChevronDownIcon as ChevronDownMoveIcon,
    FolderIcon,
} from "@heroicons/react/24/outline";
import { useState, useRef, useEffect, lazy, Suspense } from "react";
import type { JSX } from "react";
import { Directive, GroupDirective } from "@/components/common";
import DirectiveComponent from "./factory";
import { registerDirective, DirectiveMetadata } from "./registry";
import { DirectiveContainer, FormField, Input, ToggleButtonGroup, TagEditor } from "@/components/ui";

// Lazy import to avoid circular dependency
const AddDirectiveButton = lazy(() => import("@/components/add"));

interface BaseGroupEditorArgument {
    name: string;
    required: boolean;
    description?: string;
    advanced?: boolean;
}

export type GroupEditorArgument = (BaseGroupEditorArgument & {
    type: "dropdown";
    options: string[];
    defaultValue?: string;
}) | (BaseGroupEditorArgument & {
    type: "text";
    defaultValue?: string;
    multiline?: boolean;
}) | (BaseGroupEditorArgument & {
    // the array is represented as space separated strings
    type: "array";
    defaultValue?: string[];
}) | (BaseGroupEditorArgument & {
    type: "boolean";
    defaultValue?: boolean;
});

// Initialize the group editors registry at module level
const groupEditors: Map<string, GroupEditor> = new Map();

export interface GroupEditor {
    metadata: DirectiveMetadata;
    arguments: GroupEditorArgument[];
    helpContent: () => JSX.Element;
    updateDirective: (args: Record<string, unknown>) => GroupDirective;
}

export function createGroupEditorComponent(editorInfo: GroupEditor) {
    return function CustomGroupEditorComponent({
        group,
        onChange: onGroupChange,
        customParams = {},
    }: {
        group: Directive[];
        baseImage: string;
        onChange: (group: Directive[], params: Record<string, unknown>) => void;
        customParams?: Record<string, unknown>;
    }) {
        const [showAdvanced, setShowAdvanced] = useState(false);
        const initializedRef = useRef(false);

        const onChangeWrapper = (updatedGroup: Directive[], params: Record<string, unknown>) => {
            console.log("Group updated:", updatedGroup, "Params:", params);
            onGroupChange(updatedGroup, params);
        };

        // Initialize with default values if no custom params exist
        const getDefaultParams = () => {
            const defaults: Record<string, unknown> = {};
            editorInfo.arguments.forEach(arg => {
                if ('defaultValue' in arg && arg.defaultValue !== undefined) {
                    defaults[arg.name] = arg.defaultValue;
                }
            });
            return defaults;
        };

        // If no custom params exist, initialize with defaults
        const currentParams = Object.keys(customParams).length > 0 ? customParams : getDefaultParams();

        // Update a single parameter and regenerate directives
        const updateParameter = (key: string, value: unknown) => {
            const updatedParams = { ...currentParams, [key]: value };

            // Generate new directives
            const updatedDirective = editorInfo.updateDirective(updatedParams);
            onChangeWrapper(updatedDirective.group, updatedParams);
        };

        // Auto-initialize on first render if no custom params exist
        useEffect(() => {
            if (!initializedRef.current && Object.keys(customParams).length === 0) {
                const defaultParams = getDefaultParams();

                // Generate initial directives
                const updatedDirective = editorInfo.updateDirective(defaultParams);
                onChangeWrapper(updatedDirective.group, defaultParams);
                initializedRef.current = true;
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [customParams]);

        const renderArgument = (arg: GroupEditorArgument) => {
            const getDefaultValue = () => {
                if (arg.type === 'boolean' && 'defaultValue' in arg) {
                    return arg.defaultValue ?? false;
                }
                if (arg.type === 'text' && 'defaultValue' in arg) {
                    return arg.defaultValue ?? '';
                }
                if (arg.type === 'array' && 'defaultValue' in arg) {
                    return arg.defaultValue ?? [];
                }
                return '';
            };

            const currentValue = currentParams[arg.name] ?? getDefaultValue();

            if (arg.advanced && !showAdvanced) return null;

            switch (arg.type) {
                case 'dropdown':
                    return (
                        <FormField key={arg.name} label={arg.name} description={arg.description}>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6aa329] focus:border-transparent"
                                value={String(currentValue)}
                                onChange={(e) => updateParameter(arg.name, e.target.value)}
                            >
                                {arg.options.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </FormField>
                    );

                case 'boolean':
                    return (
                        <FormField key={arg.name} label={arg.name} description={arg.description}>
                            <ToggleButtonGroup
                                options={[
                                    { value: 'true', label: 'Yes' },
                                    { value: 'false', label: 'No' }
                                ]}
                                value={String(currentValue)}
                                onChange={(value) => updateParameter(arg.name, value === 'true')}
                            />
                        </FormField>
                    );

                case 'array':
                    const displayName = arg.name
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                    return (
                        <FormField key={arg.name} label={arg.name} description={arg.description}>
                            <TagEditor
                                tags={Array.isArray(currentValue) ? currentValue : []}
                                onChange={(tags) => updateParameter(arg.name, tags)}
                                placeholder={`Add ${displayName.toLowerCase()}...`}
                                emptyMessage={`No ${displayName.toLowerCase()} added yet`}
                            />
                        </FormField>
                    );

                case 'text':
                default:
                    return (
                        <FormField key={arg.name} label={arg.name} description={arg.description}>
                            {arg.multiline ? (
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6aa329] focus:border-transparent font-mono text-sm"
                                    rows={6}
                                    value={String(currentValue)}
                                    onChange={(e) => updateParameter(arg.name, e.target.value)}
                                    placeholder={`Enter ${arg.name}`}
                                />
                            ) : (
                                <Input
                                    value={String(currentValue)}
                                    onChange={(e) => updateParameter(arg.name, e.target.value)}
                                    placeholder={`Enter ${arg.name}`}
                                    monospace
                                />
                            )}
                        </FormField>
                    );
            }
        };

        const basicArgs = editorInfo.arguments.filter(arg => !arg.advanced);
        const advancedArgs = editorInfo.arguments.filter(arg => arg.advanced);

        return (
            <DirectiveContainer
                title={editorInfo.metadata.label}
                helpContent={editorInfo.helpContent()}
            >
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium text-gray-700">
                            {editorInfo.metadata.label} Configuration
                        </h4>
                        <button
                            onClick={() => {
                                // Remove custom properties and switch to advanced mode
                                onChangeWrapper(group, {});
                            }}
                            className="text-xs text-[#6aa329] hover:underline"
                            title="Switch to advanced mode for full control (cannot be undone)"
                        >
                            Switch to Advanced Mode
                        </button>
                    </div>

                    {basicArgs.map(renderArgument)}
                </div>

                {advancedArgs.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-gray-700">Advanced Settings</h4>
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-xs text-[#6aa329] hover:underline"
                            >
                                {showAdvanced ? 'Hide' : 'Show'} Advanced
                            </button>
                        </div>
                        {showAdvanced && (
                            <div className="space-y-4 border-l-4 border-[#d3e7b6] pl-4">
                                {advancedArgs.map(renderArgument)}
                            </div>
                        )}
                    </div>
                )}
            </DirectiveContainer>
        );
    };
}

export function registerGroupEditor(name: string, editor: GroupEditor) {
    groupEditors.set(name, editor);
    const component = createGroupEditorComponent(editor);
    const metadata = {
        ...editor.metadata,
        component
    };
    registerDirective(metadata);
}

export function getGroupEditor(name: string): GroupEditor | undefined {
    return groupEditors.get(name);
}

export default function GroupDirectiveComponent({
    group,
    baseImage,
    onChange,
}: {
    group: Directive[];
    baseImage: string;
    onChange: (group: Directive[]) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(
        null
    );
    const lastDirectiveRef = useRef<HTMLDivElement>(null);
    const shouldScrollToNew = useRef(false);

    const handleDirectiveChange = (
        index: number,
        updatedDirective: Directive
    ) => {
        const updatedGroup = [...group];
        updatedGroup[index] = updatedDirective;
        onChange(updatedGroup);
    };

    const addDirective = (directive: Directive, index?: number) => {
        // Only scroll if adding at the end (no index specified or index is at the end)
        shouldScrollToNew.current = index === undefined || index >= group.length;
        const updatedGroup = [...group];
        if (index !== undefined) {
            updatedGroup.splice(index, 0, directive);
        } else {
            updatedGroup.push(directive);
        }
        onChange(updatedGroup);
    };

    // Scroll to newly added directive only when explicitly added by user
    useEffect(() => {
        if (shouldScrollToNew.current && lastDirectiveRef.current) {
            setTimeout(() => {
                lastDirectiveRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                });
            }, 100);
            shouldScrollToNew.current = false;
        }
    }, [group.length]);

    const removeDirective = (index: number) => {
        const updatedGroup = group.filter((_, i) => i !== index);
        onChange(updatedGroup);
        setDeleteConfirmIndex(null);
    };

    const handleDeleteClick = (index: number) => {
        setDeleteConfirmIndex(index);
    };

    const cancelDelete = () => {
        setDeleteConfirmIndex(null);
    };

    const moveDirective = (index: number, direction: "up" | "down") => {
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= group.length) return;

        const updatedGroup = [...group];
        [updatedGroup[index], updatedGroup[newIndex]] = [
            updatedGroup[newIndex],
            updatedGroup[index],
        ];

        onChange(updatedGroup);
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverIndex(index);
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();

        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const updatedGroup = [...group];
        const draggedItem = updatedGroup[draggedIndex];

        // Remove the dragged item
        updatedGroup.splice(draggedIndex, 1);

        // Insert at the new position
        const insertIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
        updatedGroup.splice(insertIndex, 0, draggedItem);

        onChange(updatedGroup);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    return (
        <>
            <div className="bg-gray-50 rounded-md border border-gray-200 mb-3">
                <div
                    className="flex items-center justify-between p-3 bg-gray-100 rounded-t-md cursor-pointer hover:bg-gray-150 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center">
                        <button className="mr-2 text-gray-500">
                            {isExpanded ? (
                                <ChevronDownIcon className="h-4 w-4" />
                            ) : (
                                <ChevronRightIcon className="h-4 w-4" />
                            )}
                        </button>
                        <h4 className="text-sm font-medium text-gray-700">
                            Group Directive
                        </h4>
                    </div>
                    <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                        {group.length} item{group.length !== 1 ? "s" : ""}
                    </div>
                </div>

                {isExpanded && (
                    <div className="p-3 border-t border-gray-200">
                        <div className="space-y-2">
                            {group.length === 0 ? (
                                <Suspense fallback={<div>Loading...</div>}>
                                    <AddDirectiveButton
                                        onAddDirective={addDirective}
                                        variant="empty"
                                        index={0}
                                        emptyText={{
                                            title: "No items in group",
                                            subtitle: "Click here to add directives to this group"
                                        }}
                                    />
                                </Suspense>
                            ) : (
                                <>
                                    {/* First add button - only shows when there are items */}
                                    <div className="py-1">
                                        <Suspense fallback={<div>Loading...</div>}>
                                            <AddDirectiveButton
                                                onAddDirective={addDirective}
                                                variant="inline"
                                                index={0}
                                            />
                                        </Suspense>
                                    </div>

                                    {group.map((directive, index) => (
                                        <div key={index}>
                                            {/* Directive */}
                                            <div
                                                ref={
                                                    index === group.length - 1
                                                        ? lastDirectiveRef
                                                        : null
                                                }
                                                className={`flex flex-col sm:flex-row gap-2 transition-all duration-200 ${draggedIndex === index
                                                    ? "opacity-50"
                                                    : ""
                                                    } ${dragOverIndex === index && !document.body.hasAttribute("data-list-editor-dragging")
                                                        ? "border-t-2 border-[#6aa329] pt-2"
                                                        : ""
                                                    }`}
                                                draggable
                                                onDragStart={(e) =>
                                                    handleDragStart(e, index)
                                                }
                                                onDragOver={(e) =>
                                                    handleDragOver(e, index)
                                                }
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, index)}
                                                onDragEnd={handleDragEnd}
                                            >
                                                {/* Mobile: Horizontal Controls */}
                                                <div className="flex sm:hidden items-center justify-between bg-white p-2 rounded border border-gray-200">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                                                            onMouseDown={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                        >
                                                            <Bars3Icon className="h-3 w-3" />
                                                        </button>
                                                        <span className="text-xs font-medium text-gray-500">
                                                            {index + 1}
                                                        </span>
                                                        <div className="flex gap-1">
                                                            <button
                                                                className={`p-1 rounded ${index === 0
                                                                    ? "text-gray-300 cursor-not-allowed"
                                                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                                                    } transition-colors`}
                                                                onClick={() =>
                                                                    moveDirective(
                                                                        index,
                                                                        "up"
                                                                    )
                                                                }
                                                                disabled={index === 0}
                                                                title="Move up"
                                                            >
                                                                <ChevronUpIcon className="h-3 w-3" />
                                                            </button>
                                                            <button
                                                                className={`p-1 rounded ${index ===
                                                                    group.length - 1
                                                                    ? "text-gray-300 cursor-not-allowed"
                                                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                                                    } transition-colors`}
                                                                onClick={() =>
                                                                    moveDirective(
                                                                        index,
                                                                        "down"
                                                                    )
                                                                }
                                                                disabled={
                                                                    index ===
                                                                    group.length - 1
                                                                }
                                                                title="Move down"
                                                            >
                                                                <ChevronDownMoveIcon className="h-3 w-3" />
                                                            </button>
                                                            <button
                                                                className="text-red-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                                                                onClick={() =>
                                                                    handleDeleteClick(
                                                                        index
                                                                    )
                                                                }
                                                                title="Delete item"
                                                            >
                                                                <TrashIcon className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Desktop: Vertical Controls */}
                                                <div className="hidden sm:flex flex-col items-center pt-2 flex-shrink-0">
                                                    <div className="flex flex-col bg-white border border-gray-200 rounded shadow-sm">
                                                        <button
                                                            className="p-1.5 border-b border-gray-200 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing transition-colors"
                                                            onMouseDown={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                            title="Drag to reorder"
                                                        >
                                                            <Bars3Icon className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            className={`p-1.5 border-b border-gray-200 ${index === 0
                                                                ? "text-gray-300 cursor-not-allowed"
                                                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                                                } transition-colors`}
                                                            onClick={() =>
                                                                moveDirective(
                                                                    index,
                                                                    "up"
                                                                )
                                                            }
                                                            disabled={index === 0}
                                                            title="Move up"
                                                        >
                                                            <ChevronUpIcon className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            className={`p-1.5 border-b border-gray-200 ${index ===
                                                                group.length - 1
                                                                ? "text-gray-300 cursor-not-allowed"
                                                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                                                } transition-colors`}
                                                            onClick={() =>
                                                                moveDirective(
                                                                    index,
                                                                    "down"
                                                                )
                                                            }
                                                            disabled={
                                                                index === group.length - 1
                                                            }
                                                            title="Move down"
                                                        >
                                                            <ChevronDownMoveIcon className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                            onClick={() =>
                                                                handleDeleteClick(index)
                                                            }
                                                            title="Delete item"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                    <div className="mt-1 text-xs font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                                        {index + 1}
                                                    </div>
                                                </div>

                                                {/* Directive Content */}
                                                <div className="flex-1 min-w-0">
                                                    <DirectiveComponent
                                                        directive={directive}
                                                        baseImage={baseImage}
                                                        onChange={(updated) =>
                                                            handleDirectiveChange(
                                                                index,
                                                                updated
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>

                                            {/* Add button after this directive */}
                                            <div className="py-1">
                                                <Suspense fallback={<div>Loading...</div>}>
                                                    <AddDirectiveButton
                                                        onAddDirective={addDirective}
                                                        variant="inline"
                                                        index={index + 1}
                                                    />
                                                </Suspense>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmIndex !== null && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                    <TrashIcon className="h-6 w-6 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900">
                                        Delete Group Item
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        Item {deleteConfirmIndex + 1} in group
                                    </p>
                                </div>
                            </div>
                            <p className="text-gray-700 mb-6">
                                Are you sure you want to delete this item from
                                the group? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                    onClick={cancelDelete}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                                    onClick={() =>
                                        removeDirective(deleteConfirmIndex)
                                    }
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// Register this directive
export const groupDirectiveMetadata: DirectiveMetadata = {
    key: "group",
    label: "Group",
    description: "Group related directives together",
    icon: FolderIcon,
    color: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    iconColor: "text-blue-600",
    defaultValue: { group: [] as Directive[] },
    keywords: ["group", "folder", "organize", "collection"],
    component: GroupDirectiveComponent,
};

registerDirective(groupDirectiveMetadata);