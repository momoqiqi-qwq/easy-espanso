import type { Match } from '@/types/core/espanso.types';
import type { ConfigTreeNode } from '@/types/core/ui.types';
import type { TreeNodeItem } from '@/types/tree.types';

export type Translate = (key: string) => string;

const TIMESTAMP_NAME = /^\d{13}_/;

function compareTreeNames(a: { name: string }, b: { name: string }): number {
  const aTimestamped = TIMESTAMP_NAME.test(a.name);
  const bTimestamped = TIMESTAMP_NAME.test(b.name);

  if (aTimestamped && bTimestamped) {
    const aTimestamp = Number.parseInt(a.name.split('_')[0], 10);
    const bTimestamp = Number.parseInt(b.name.split('_')[0], 10);
    return bTimestamp - aTimestamp;
  }
  if (aTimestamped) return -1;
  if (bTimestamped) return 1;
  return a.name.localeCompare(b.name);
}

function createMatchNode(match: Match, t: Translate): TreeNodeItem {
  let displayName = match.trigger || '';
  if (!displayName && Array.isArray(match.triggers) && match.triggers.length > 0) {
    displayName = match.triggers[0];
    if (match.triggers.length > 1) displayName += '...';
  } else if (!displayName) {
    displayName = t('snippets.noTrigger');
  }

  return {
    id: match.id,
    type: 'match',
    name: displayName,
    match,
    children: [],
  };
}

function convertNode(node: any, t: Translate, isTopLevel = false): TreeNodeItem | null {
  if (!node) return null;

  if (isTopLevel && node.type === 'folder' && node.name === 'packages') {
    const packagesNode: TreeNodeItem = {
      id: node.id || `folder-${node.path || 'packages'}`,
      type: 'folder',
      name: t('fileDetails.packageFile'),
      path: node.path,
      children: [],
    };

    for (const packageSubDir of node.children || []) {
      if (packageSubDir.type !== 'folder') continue;
      const packageYml = packageSubDir.children?.find(
        (file: any) => file.type === 'file' && file.name === 'package.yml',
      );
      // Keep an empty package visible after it is created from the context menu.
      // The hidden package.yml is the marker that this folder is a managed package.
      if (!packageYml) continue;

      packagesNode.children.push({
        id: packageSubDir.id || `folder-${packageSubDir.path}`,
        type: 'folder',
        name: packageSubDir.name,
        path: packageSubDir.path,
        children: (packageYml.matches || []).map((match: Match) => createMatchNode(match, t)),
      });
    }

    return packagesNode;
  }

  const children = (node.children || [])
    .map((child: any) => convertNode(child, t))
    .filter((item: TreeNodeItem | null): item is TreeNodeItem => item !== null);

  if (Array.isArray(node.matches)) {
    children.push(...node.matches.map((match: Match) => createMatchNode(match, t)));
  }

  return {
    id: node.id || `${node.type}-${node.path || node.name}`,
    type: node.type,
    name: node.name,
    path: node.path,
    children,
    match: node.type === 'match' ? node : undefined,
  };
}

/**
 * Builds the renderer-only tree model without mutating the store tree.
 * Keeping this out of ConfigTree.vue avoids a large reactive component and makes
 * the conversion easy to unit-test later.
 */
export function buildTreeData(configTree: ConfigTreeNode[], t: Translate): TreeNodeItem[] {
  const seenMatchFolders = new Set<string>();
  const uniqueTree = configTree.filter((node: any) => {
    if (node.type !== 'folder' || node.name !== 'match') return true;
    const key = node.path || node.id;
    if (seenMatchFolders.has(key)) return false;
    seenMatchFolders.add(key);
    return true;
  });

  const flattened: any[] = [];
  for (const node of uniqueTree as any[]) {
    if (node.type === 'folder' && node.name === 'match') {
      flattened.push(...[...(node.children || [])].sort(compareTreeNames));
    } else {
      flattened.push(node);
    }
  }

  const tree = flattened
    .map((node: any) => convertNode(node, t, true))
    .filter((item): item is TreeNodeItem => item !== null)
    .filter((node) => !(node.type === 'folder' && node.name === 'config'));

  const packagesIndex = tree.findIndex(
    (node) => node.type === 'folder' && node.name === t('fileDetails.packageFile'),
  );
  const packagesNode = packagesIndex >= 0 ? tree.splice(packagesIndex, 1)[0] : undefined;

  tree.sort(compareTreeNames);
  if (packagesNode) tree.push(packagesNode);
  return tree;
}
