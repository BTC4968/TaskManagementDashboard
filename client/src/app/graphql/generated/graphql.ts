import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type CreateTaskInput = {
  assignee?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<TaskStatus>;
  title: Scalars['String']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  createTask: Task;
  deleteTask: Scalars['Boolean']['output'];
  simulateNetworkFailure: Scalars['Boolean']['output'];
  updateTask: TaskUpdateResult;
};


export type MutationCreateTaskArgs = {
  input: CreateTaskInput;
};


export type MutationDeleteTaskArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateTaskArgs = {
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  input: UpdateTaskInput;
};

export type PageInfo = {
  __typename?: 'PageInfo';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  health: Scalars['String']['output'];
  task?: Maybe<Task>;
  tasks: TaskConnection;
};


export type QueryTaskArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTasksArgs = {
  filter?: InputMaybe<TaskFilterInput>;
  page?: Scalars['Int']['input'];
  pageSize?: Scalars['Int']['input'];
  sort?: InputMaybe<Array<TaskSortInput>>;
};

export enum SortDirection {
  Asc = 'ASC',
  Desc = 'DESC'
}

export type Subscription = {
  __typename?: 'Subscription';
  taskChanged: TaskEvent;
};

export type Task = {
  __typename?: 'Task';
  assignee?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  priority: Scalars['Int']['output'];
  status: TaskStatus;
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

export type TaskConnection = {
  __typename?: 'TaskConnection';
  nodes: Array<Task>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type TaskEvent = {
  __typename?: 'TaskEvent';
  task: Task;
  type: TaskEventType;
};

export enum TaskEventType {
  Created = 'CREATED',
  Deleted = 'DELETED',
  Updated = 'UPDATED'
}

export type TaskFilterInput = {
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<TaskStatus>;
};

export type TaskSortInput = {
  direction: SortDirection;
  field: Scalars['String']['input'];
};

export enum TaskStatus {
  Done = 'DONE',
  InProgress = 'IN_PROGRESS',
  Todo = 'TODO'
}

export type TaskUpdateResult = {
  __typename?: 'TaskUpdateResult';
  conflict: Scalars['Boolean']['output'];
  success: Scalars['Boolean']['output'];
  task?: Maybe<Task>;
};

export type UpdateTaskInput = {
  assignee?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<TaskStatus>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type TasksQueryVariables = Exact<{
  page: Scalars['Int']['input'];
  pageSize: Scalars['Int']['input'];
  filter?: InputMaybe<TaskFilterInput>;
  sort?: InputMaybe<Array<TaskSortInput> | TaskSortInput>;
}>;


export type TasksQuery = { __typename?: 'Query', tasks: { __typename?: 'TaskConnection', totalCount: number, nodes: Array<{ __typename?: 'Task', id: string, title: string, description?: string | null, status: TaskStatus, priority: number, assignee?: string | null, version: number, updatedAt: string }>, pageInfo: { __typename?: 'PageInfo', page: number, pageSize: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type TaskQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type TaskQuery = { __typename?: 'Query', task?: { __typename?: 'Task', id: string, title: string, description?: string | null, status: TaskStatus, priority: number, assignee?: string | null, version: number, updatedAt: string } | null };

export type CreateTaskMutationVariables = Exact<{
  input: CreateTaskInput;
}>;


export type CreateTaskMutation = { __typename?: 'Mutation', createTask: { __typename?: 'Task', id: string, title: string, description?: string | null, status: TaskStatus, priority: number, assignee?: string | null, version: number, updatedAt: string } };

export type UpdateTaskMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateTaskInput;
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
}>;


export type UpdateTaskMutation = { __typename?: 'Mutation', updateTask: { __typename?: 'TaskUpdateResult', success: boolean, conflict: boolean, task?: { __typename?: 'Task', id: string, title: string, description?: string | null, status: TaskStatus, priority: number, assignee?: string | null, version: number, updatedAt: string } | null } };

export type DeleteTaskMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteTaskMutation = { __typename?: 'Mutation', deleteTask: boolean };

export type SimulateNetworkFailureMutationVariables = Exact<{ [key: string]: never; }>;


export type SimulateNetworkFailureMutation = { __typename?: 'Mutation', simulateNetworkFailure: boolean };

export type TaskChangedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type TaskChangedSubscription = { __typename?: 'Subscription', taskChanged: { __typename?: 'TaskEvent', type: TaskEventType, task: { __typename?: 'Task', id: string, title: string, description?: string | null, status: TaskStatus, priority: number, assignee?: string | null, version: number, updatedAt: string } } };

export const TasksDocument = gql`
    query Tasks($page: Int!, $pageSize: Int!, $filter: TaskFilterInput, $sort: [TaskSortInput!]) {
  tasks(page: $page, pageSize: $pageSize, filter: $filter, sort: $sort) {
    nodes {
      id
      title
      description
      status
      priority
      assignee
      version
      updatedAt
    }
    totalCount
    pageInfo {
      page
      pageSize
      hasNextPage
      hasPreviousPage
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class TasksGQL extends Apollo.Query<TasksQuery, TasksQueryVariables> {
    override document = TasksDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const TaskDocument = gql`
    query Task($id: ID!) {
  task(id: $id) {
    id
    title
    description
    status
    priority
    assignee
    version
    updatedAt
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class TaskGQL extends Apollo.Query<TaskQuery, TaskQueryVariables> {
    override document = TaskDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const CreateTaskDocument = gql`
    mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) {
    id
    title
    description
    status
    priority
    assignee
    version
    updatedAt
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateTaskGQL extends Apollo.Mutation<CreateTaskMutation, CreateTaskMutationVariables> {
    override document = CreateTaskDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const UpdateTaskDocument = gql`
    mutation UpdateTask($id: ID!, $input: UpdateTaskInput!, $expectedVersion: Int) {
  updateTask(id: $id, input: $input, expectedVersion: $expectedVersion) {
    success
    conflict
    task {
      id
      title
      description
      status
      priority
      assignee
      version
      updatedAt
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateTaskGQL extends Apollo.Mutation<UpdateTaskMutation, UpdateTaskMutationVariables> {
    override document = UpdateTaskDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const DeleteTaskDocument = gql`
    mutation DeleteTask($id: ID!) {
  deleteTask(id: $id)
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class DeleteTaskGQL extends Apollo.Mutation<DeleteTaskMutation, DeleteTaskMutationVariables> {
    override document = DeleteTaskDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const SimulateNetworkFailureDocument = gql`
    mutation SimulateNetworkFailure {
  simulateNetworkFailure
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class SimulateNetworkFailureGQL extends Apollo.Mutation<SimulateNetworkFailureMutation, SimulateNetworkFailureMutationVariables> {
    override document = SimulateNetworkFailureDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const TaskChangedDocument = gql`
    subscription TaskChanged {
  taskChanged {
    type
    task {
      id
      title
      description
      status
      priority
      assignee
      version
      updatedAt
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class TaskChangedGQL extends Apollo.Subscription<TaskChangedSubscription, TaskChangedSubscriptionVariables> {
    override document = TaskChangedDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }