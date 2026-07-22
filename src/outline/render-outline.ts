import type { HeadingObject } from "../types/citationTypes.js";

export interface HeadingTreeNode {
	index: number;
	heading: HeadingObject;
	parentIndex: number | null;
	childIndexes: number[];
}

export interface RenderOutlineOptions {
	maxLevel?: number;
	expandedIndexes?: ReadonlySet<number>;
	withinIndex?: number;
}

export interface RenderedOutline {
	text: string;
	collapsedIndexes: number[];
}

/** Build parent-child relationships from document-order headings, including skipped levels. */
export function buildHeadingTree(headings: HeadingObject[]): HeadingTreeNode[] {
	const nodes: HeadingTreeNode[] = [];
	const stack: number[] = [];

	for (const [index, heading] of headings.entries()) {
		while (stack.length > 0) {
			const parent = nodes[stack[stack.length - 1] ?? -1];
			if (parent && parent.heading.level < heading.level) break;
			stack.pop();
		}

		const parentIndex = stack[stack.length - 1] ?? null;
		nodes.push({ index, heading, parentIndex, childIndexes: [] });
		if (parentIndex !== null) nodes[parentIndex]?.childIndexes.push(index);
		stack.push(index);
	}

	return nodes;
}

function descendantsOf(nodes: HeadingTreeNode[], index: number): Set<number> {
	const descendants = new Set<number>();
	const pending = [...(nodes[index]?.childIndexes ?? [])];
	while (pending.length > 0) {
		const child = pending.pop();
		if (child === undefined || descendants.has(child)) continue;
		descendants.add(child);
		pending.push(...(nodes[child]?.childIndexes ?? []));
	}
	return descendants;
}

function ancestorsOf(nodes: HeadingTreeNode[], index: number): Set<number> {
	const ancestors = new Set<number>();
	let current = nodes[index]?.parentIndex ?? null;
	while (current !== null) {
		ancestors.add(current);
		current = nodes[current]?.parentIndex ?? null;
	}
	return ancestors;
}

/** Render parser-derived headings as a compact quoted text tree. */
export function renderOutline(
	headings: HeadingObject[],
	options: RenderOutlineOptions = {},
): RenderedOutline {
	if (headings.length === 0) {
		return {
			text: "No headings found. Use jact extract file for all content.",
			collapsedIndexes: [],
		};
	}

	const maxLevel = options.maxLevel ?? 2;
	const expanded = options.expandedIndexes ?? new Set<number>();
	const nodes = buildHeadingTree(headings);
	const scope = new Set<number>();
	const forcedContext = new Set<number>();

	if (options.withinIndex === undefined) {
		for (const node of nodes) scope.add(node.index);
	} else {
		scope.add(options.withinIndex);
		for (const index of descendantsOf(nodes, options.withinIndex))
			scope.add(index);
		for (const index of ancestorsOf(nodes, options.withinIndex)) {
			scope.add(index);
			forcedContext.add(index);
		}
		forcedContext.add(options.withinIndex);
	}

	const expandedScope = new Set<number>();
	for (const index of expanded) {
		expandedScope.add(index);
		for (const descendant of descendantsOf(nodes, index)) {
			expandedScope.add(descendant);
		}
		for (const ancestor of ancestorsOf(nodes, index))
			forcedContext.add(ancestor);
	}

	const visible = new Set<number>();
	for (const node of nodes) {
		if (!scope.has(node.index)) continue;
		if (
			node.heading.level <= maxLevel ||
			expandedScope.has(node.index) ||
			forcedContext.has(node.index)
		) {
			visible.add(node.index);
		}
	}

	const collapsedIndexes: number[] = [];
	for (const node of nodes) {
		if (!visible.has(node.index) || expanded.has(node.index)) continue;
		const hasHiddenDescendant = [...descendantsOf(nodes, node.index)].some(
			(index) => scope.has(index) && !visible.has(index),
		);
		if (hasHiddenDescendant) collapsedIndexes.push(node.index);
	}
	const collapsed = new Set(collapsedIndexes);

	const lines: string[] = [];
	const renderNode = (
		index: number,
		prefix: string,
		connector: string,
	): void => {
		const node = nodes[index];
		if (!node || !visible.has(index)) return;
		const marker = collapsed.has(index) ? " [*]" : "";
		lines.push(
			`${prefix}${connector}${JSON.stringify(node.heading.text)}${marker}`,
		);

		const children = node.childIndexes.filter((child) => visible.has(child));
		for (const [childPosition, child] of children.entries()) {
			const last = childPosition === children.length - 1;
			renderNode(
				child,
				`${prefix}${connector ? (connector === "└── " ? "    " : "│   ") : ""}`,
				last ? "└── " : "├── ",
			);
		}
	};

	const roots = nodes.filter(
		(node) =>
			visible.has(node.index) &&
			(node.parentIndex === null || !visible.has(node.parentIndex)),
	);
	for (const root of roots) renderNode(root.index, "", "");

	return { text: lines.join("\n"), collapsedIndexes };
}
