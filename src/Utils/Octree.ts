import { Box3, Vector3, Frustum } from "three";

/**
 * Octree node for spatial partitioning
 */
class OctreeNode<T> {
    bounds: Box3;
    center: Vector3;
    children: OctreeNode<T>[] | null;
    items: { position: Vector3, data: T }[];
    maxItems: number;
    maxDepth: number;
    depth: number;

    constructor(bounds: Box3, maxItems: number, maxDepth: number, depth: number = 0) {
        this.bounds = bounds;
        this.center = new Vector3();
        bounds.getCenter(this.center);
        this.children = null;
        this.items = [];
        this.maxItems = maxItems;
        this.maxDepth = maxDepth;
        this.depth = depth;
    }

    /**
     * Insert an item into the octree
     */
    insert(position: Vector3, data: T): boolean {
        // Check if point is in bounds
        if (!this.bounds.containsPoint(position)) {
            return false;
        }

        // If we have children, insert into appropriate child
        if (this.children) {
            for (const child of this.children) {
                if (child.insert(position, data)) {
                    return true;
                }
            }
            return false;
        }

        // Add to this node
        this.items.push({ position: position.clone(), data });

        // Split if we exceed capacity and haven't reached max depth
        if (this.items.length > this.maxItems && this.depth < this.maxDepth) {
            this.split();
        }

        return true;
    }

    /**
     * Split this node into 8 children
     */
    private split(): void {
        const min = this.bounds.min;
        const max = this.bounds.max;
        const center = this.center;

        this.children = [
            // Bottom four octants
            new OctreeNode<T>(new Box3(new Vector3(min.x, min.y, min.z), new Vector3(center.x, center.y, center.z)), this.maxItems, this.maxDepth, this.depth + 1),
            new OctreeNode<T>(new Box3(new Vector3(center.x, min.y, min.z), new Vector3(max.x, center.y, center.z)), this.maxItems, this.maxDepth, this.depth + 1),
            new OctreeNode<T>(new Box3(new Vector3(min.x, min.y, center.z), new Vector3(center.x, center.y, max.z)), this.maxItems, this.maxDepth, this.depth + 1),
            new OctreeNode<T>(new Box3(new Vector3(center.x, min.y, center.z), new Vector3(max.x, center.y, max.z)), this.maxItems, this.maxDepth, this.depth + 1),

            // Top four octants
            new OctreeNode<T>(new Box3(new Vector3(min.x, center.y, min.z), new Vector3(center.x, max.y, center.z)), this.maxItems, this.maxDepth, this.depth + 1),
            new OctreeNode<T>(new Box3(new Vector3(center.x, center.y, min.z), new Vector3(max.x, max.y, center.z)), this.maxItems, this.maxDepth, this.depth + 1),
            new OctreeNode<T>(new Box3(new Vector3(min.x, center.y, center.z), new Vector3(center.x, max.y, max.z)), this.maxItems, this.maxDepth, this.depth + 1),
            new OctreeNode<T>(new Box3(new Vector3(center.x, center.y, center.z), new Vector3(max.x, max.y, max.z)), this.maxItems, this.maxDepth, this.depth + 1),
        ];

        // Redistribute items to children
        for (const item of this.items) {
            for (const child of this.children) {
                if (child.insert(item.position, item.data)) {
                    break;
                }
            }
        }

        // Clear items from this node (now stored in children)
        this.items = [];
    }

    /**
     * Query items within a frustum
     */
    queryFrustum(frustum: Frustum, results: T[]): void {
        // Check if frustum intersects this node's bounds
        if (!frustum.intersectsBox(this.bounds)) {
            return;
        }

        // If we have items, add them to results
        for (const item of this.items) {
            results.push(item.data);
        }

        // Recursively query children
        if (this.children) {
            for (const child of this.children) {
                child.queryFrustum(frustum, results);
            }
        }
    }

    /**
     * Query items within a bounding box
     */
    queryBox(box: Box3, results: T[]): void {
        // Check if boxes intersect
        if (!this.bounds.intersectsBox(box)) {
            return;
        }

        // Check items
        for (const item of this.items) {
            if (box.containsPoint(item.position)) {
                results.push(item.data);
            }
        }

        // Recursively query children
        if (this.children) {
            for (const child of this.children) {
                child.queryBox(box, results);
            }
        }
    }

    /**
     * Get statistics about the octree
     */
    getStats(): { nodes: number, maxDepth: number, totalItems: number } {
        let nodes = 1;
        let maxDepth = this.depth;
        let totalItems = this.items.length;

        if (this.children) {
            for (const child of this.children) {
                const childStats = child.getStats();
                nodes += childStats.nodes;
                maxDepth = Math.max(maxDepth, childStats.maxDepth);
                totalItems += childStats.totalItems;
            }
        }

        return { nodes, maxDepth, totalItems };
    }
}

/**
 * Octree for spatial partitioning of atoms
 */
export class Octree<T> {
    private root: OctreeNode<T>;
    private maxItems: number;
    private maxDepth: number;

    constructor(bounds: Box3, maxItems: number = 128, maxDepth: number = 6) {
        // Increased maxItems from 64->128, reduced maxDepth from 10->6
        // This reduces node count and speeds up building/querying for large structures
        this.root = new OctreeNode<T>(bounds, maxItems, maxDepth);
        this.maxItems = maxItems;
        this.maxDepth = maxDepth;
    }

    /**
     * Insert an item at a position
     */
    insert(position: Vector3, data: T): boolean {
        return this.root.insert(position, data);
    }

    /**
     * Query items within a frustum (for frustum culling)
     */
    queryFrustum(frustum: Frustum): T[] {
        const results: T[] = [];
        this.root.queryFrustum(frustum, results);
        return results;
    }

    /**
     * Query items within a bounding box
     */
    queryBox(box: Box3): T[] {
        const results: T[] = [];
        this.root.queryBox(box, results);
        return results;
    }

    /**
     * Get octree statistics
     */
    getStats(): { nodes: number, maxDepth: number, totalItems: number } {
        return this.root.getStats();
    }
}
