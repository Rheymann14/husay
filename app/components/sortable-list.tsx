import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useId, type ReactNode } from "react";

// Vertical drag-to-sort list. Items move only by their drag handle, so inputs
// and editors inside an item stay usable; the handle also works by keyboard
// (focus it, Space to pick up, arrows to move, Space to drop).
export function SortableList<T>({
  items,
  getId,
  onReorder,
  children,
}: {
  items: T[];
  getId: (item: T) => UniqueIdentifier;
  onReorder: (items: T[]) => void;
  children: ReactNode;
}) {
  // A stable id keeps the server and client accessibility ids in sync.
  const id = useId();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(items, ids.indexOf(active.id), ids.indexOf(over.id)));
  };

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

// A list item of a SortableList. `children` gets the drag handle to place
// wherever it fits the item's layout.
export function SortableItem({
  id,
  className = "",
  handleLabel,
  children,
}: {
  id: UniqueIdentifier;
  className?: string;
  handleLabel: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={handleLabel}
      title="Drag to reorder"
      className="shrink-0 cursor-grab touch-none rounded-md p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-navy-600 active:cursor-grabbing"
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      // Translate only: rows differ in height, and scaling would stretch them.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${className} ${isDragging ? "relative z-10 shadow-lg ring-2 ring-navy-600/30" : ""}`}
    >
      {children(handle)}
    </li>
  );
}
