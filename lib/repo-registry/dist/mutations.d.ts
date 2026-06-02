import type { RepoIdentity } from './types.js';
export interface AddRepoOpts {
    root: string;
    name: string;
    identity: RepoIdentity;
    localPath: string;
}
export interface EditRepoOpts {
    root: string;
    name: string;
    description?: string;
    remote?: string;
    defaultBranch?: string;
}
export interface RemoveRepoOpts {
    root: string;
    name: string;
}
export interface BindRepoOpts {
    root: string;
    name: string;
    localPath: string;
}
export interface CreateGroupOpts {
    root: string;
    name: string;
    members: string[];
    description?: string;
}
export interface EditGroupOpts {
    root: string;
    name: string;
    description: string;
}
export interface GroupMemberOpts {
    root: string;
    group: string;
    repo: string;
}
export interface DeleteGroupOpts {
    root: string;
    name: string;
}
export declare function addRepo({ root, name, identity, localPath }: AddRepoOpts): void;
export declare function removeRepo({ root, name }: RemoveRepoOpts): void;
export declare function createGroup({ root, name, members, description }: CreateGroupOpts): void;
export declare function addGroupMember({ root, group, repo }: GroupMemberOpts): void;
export declare function removeGroupMember({ root, group, repo }: GroupMemberOpts): void;
export declare function deleteGroup({ root, name }: DeleteGroupOpts): void;
export declare function editRepo({ root, name, description, remote, defaultBranch }: EditRepoOpts): RepoIdentity;
export declare function bindRepo({ root, name, localPath }: BindRepoOpts): void;
export declare function editGroup({ root, name, description }: EditGroupOpts): void;
