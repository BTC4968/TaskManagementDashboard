import { gql } from 'apollo-angular';

export const TASKS_QUERY = gql`
  query Tasks(
    $page: Int!
    $pageSize: Int!
    $filter: TaskFilterInput
    $sort: [TaskSortInput!]
  ) {
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

export const CREATE_TASK_MUTATION = gql`
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

export const UPDATE_TASK_MUTATION = gql`
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

export const DELETE_TASK_MUTATION = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;

export const SIMULATE_FAILURE_MUTATION = gql`
  mutation SimulateNetworkFailure {
    simulateNetworkFailure
  }
`;

export const TASK_CHANGED_SUBSCRIPTION = gql`
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
