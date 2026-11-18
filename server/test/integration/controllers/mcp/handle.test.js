/*
 * Requires a PostgreSQL datastore: the actions behind the tools use native SQL paths that
 * sails-disk (the default in config/env/test.js) does not support. Run with
 * NODE_ENV=test and the datastore overridden, e.g. sails_datastores__default__adapter=sails-postgresql
 * and sails_datastores__default__url=postgresql://user:pass@localhost/db.
 */

const { expect } = require('chai');
const request = require('supertest');

const { POSITION_GAP } = require('../../../../constants');

describe('POST /api/mcp', () => {
  const suffix = Date.now().toString(36);
  const apiKeyByUserId = {};
  const createdUserIds = [];
  let counter = 0;
  let rpcId = 0;

  let editor;
  let viewer;
  let outsider;
  let project;
  let board;
  let otherBoard;
  let list;
  let otherList;
  let otherBoardList;
  let archiveList;
  let label;

  const createUser = async (values = {}) => {
    counter += 1;

    const { key, prefix } = sails.helpers.utils.generateApiKey();

    const user = await User.qm.createOne({
      email: `mcp-${suffix}-${counter}@test.test`,
      role: User.Roles.BOARD_USER,
      name: `MCP ${counter}`,
      apiKeyPrefix: prefix,
      apiKeyHash: sails.helpers.utils.hash(key),
      ...values,
    });

    createdUserIds.push(user.id);
    apiKeyByUserId[user.id] = key;

    return user;
  };

  const createList = (values) =>
    List.qm.createOne({
      boardId: board.id,
      type: List.Types.ACTIVE,
      ...values,
    });

  const postMcp = (body, headers = {}) =>
    request(sails.hooks.http.app)
      .post('/api/mcp')
      .set({
        Accept: 'application/json, text/event-stream',
        ...headers,
      })
      .send(body);

  const sendRpc = (user, method, params) => {
    rpcId += 1;

    return postMcp(
      {
        method,
        params,
        jsonrpc: '2.0',
        id: rpcId,
      },
      {
        'X-Api-Key': apiKeyByUserId[user.id],
      },
    );
  };

  const callTool = async (user, name, args = {}) => {
    const response = await sendRpc(user, 'tools/call', {
      name,
      arguments: args,
    });

    expect(response.status).to.equal(200);

    const { isError, content } = response.body.result;
    const [{ text }] = content;

    return {
      text,
      isError: !!isError,
      data: isError ? undefined : JSON.parse(text),
    };
  };

  const expectToolError = async (user, name, args, message) => {
    const result = await callTool(user, name, args);

    expect(result.isError).to.equal(true);
    expect(result.text).to.equal(message);
  };

  const createCard = async (values = {}) => {
    const { data } = await callTool(editor, 'create_card', {
      listId: list.id,
      name: 'Card',
      ...values,
    });

    return data.item;
  };

  before(async () => {
    editor = await createUser();
    viewer = await createUser();
    outsider = await createUser();

    ({ project } = await Project.qm.createOne({ name: `MCP ${suffix}` }, { user: editor }));

    let boardLists;
    ({ board, lists: boardLists } = await Board.qm.createOne(
      {
        projectId: project.id,
        position: POSITION_GAP,
        name: 'Board',
      },
      { user: editor },
    ));

    ({ board: otherBoard } = await Board.qm.createOne(
      {
        projectId: project.id,
        position: POSITION_GAP * 2,
        name: 'Other board',
      },
      { user: editor },
    ));

    await BoardMembership.qm.createOne({
      projectId: project.id,
      boardId: board.id,
      userId: viewer.id,
      role: BoardMembership.Roles.VIEWER,
    });

    list = await createList({ position: POSITION_GAP, name: 'Todo' });
    otherList = await createList({ position: POSITION_GAP * 2, name: 'Done' });

    otherBoardList = await List.qm.createOne({
      boardId: otherBoard.id,
      type: List.Types.ACTIVE,
      position: POSITION_GAP,
      name: 'Other todo',
    });

    archiveList = boardLists.find(({ type }) => type === List.Types.ARCHIVE);

    label = await Label.qm.createOne({
      boardId: board.id,
      position: POSITION_GAP,
      name: 'Bug',
      color: Label.COLORS[0],
    });
  });

  after(async () => {
    if (project) {
      const boards = await Board.qm.getByProjectId(project.id);

      // eslint-disable-next-line no-restricted-syntax
      for (const record of boards) {
        // eslint-disable-next-line no-await-in-loop
        await sails.helpers.boards.deleteOne.with({ project, record, actorUser: editor });
      }

      await ProjectManager.destroy({ projectId: project.id });
      await Project.qm.deleteOne(project.id);
    }

    if (createdUserIds.length > 0) {
      await User.destroy({ id: createdUserIds });
    }
  });

  describe('auth', () => {
    const listTools = (headers) =>
      postMcp(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
        },
        headers,
      );

    it('rejects requests without an API key', async () => {
      const response = await listTools();

      expect(response.status).to.equal(401);
    });

    it('rejects an unknown API key', async () => {
      const response = await listTools({ 'X-Api-Key': 'unknown' });

      expect(response.status).to.equal(401);
    });

    it('rejects a session access token', async () => {
      const { token: accessToken } = sails.helpers.utils.createJwtToken(editor.id);

      const session = await Session.qm.createOne({
        accessToken,
        userId: editor.id,
        remoteAddress: '127.0.0.1',
      });

      try {
        const response = await listTools({ Authorization: `Bearer ${accessToken}` });

        expect(response.status).to.equal(401);
      } finally {
        await Session.destroy({ id: session.id });
      }
    });

    it('rejects the internal access token', async () => {
      const { internalAccessToken } = sails.config.custom;
      sails.config.custom.internalAccessToken = `internal-${suffix}`;

      try {
        const response = await listTools({
          Authorization: `Bearer ${sails.config.custom.internalAccessToken}`,
        });

        expect(response.status).to.equal(404);
      } finally {
        sails.config.custom.internalAccessToken = internalAccessToken;
      }
    });

    it('answers initialize with the server info and tools capability', async () => {
      const response = await sendRpc(editor, 'initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: {
          name: 'test',
          version: '1.0.0',
        },
      });

      expect(response.status).to.equal(200);
      expect(response.body.result.serverInfo.name).to.equal('planka');
      expect(response.body.result.capabilities).to.have.property('tools');
    });

    it('lists every tool for an API key user', async () => {
      const response = await sendRpc(editor, 'tools/list', {});

      expect(response.status).to.equal(200);
      expect(response.body.result.tools.map(({ name }) => name)).to.have.members([
        'list_projects',
        'get_project',
        'list_boards',
        'get_board',
        'list_cards',
        'get_card',
        'search_cards',
        'create_card',
        'update_card',
        'move_card',
        'delete_card',
        'create_task',
        'update_task',
        'delete_task',
        'add_label_to_card',
        'remove_label_from_card',
        'add_member_to_card',
        'remove_member_from_card',
        'create_comment',
        'list_comments',
      ]);
    });

    it('answers GET and DELETE with 405', async () => {
      const { app } = sails.hooks.http;
      const headers = {
        Accept: 'application/json, text/event-stream',
        'X-Api-Key': apiKeyByUserId[editor.id],
      };

      const getResponse = await request(app).get('/api/mcp').set(headers);
      const deleteResponse = await request(app).delete('/api/mcp').set(headers);

      expect(getResponse.status).to.equal(405);
      expect(getResponse.headers.allow).to.equal('POST');
      expect(deleteResponse.status).to.equal(405);
    });
  });

  describe('projects and boards', () => {
    it('list_projects returns accessible projects with their boards', async () => {
      const { data } = await callTool(viewer, 'list_projects');

      expect(data.projects.map(({ id }) => id)).to.include(project.id);
      expect(data.boards.map(({ id }) => id)).to.include(board.id);
      expect(data.boards.map(({ id }) => id)).not.to.include(otherBoard.id);
    });

    it('list_projects hides projects of outsiders', async () => {
      const { data } = await callTool(outsider, 'list_projects');

      expect(data.projects.map(({ id }) => id)).not.to.include(project.id);
    });

    it('get_project returns the project', async () => {
      const { data } = await callTool(viewer, 'get_project', { projectId: project.id });

      expect(data.item.id).to.equal(project.id);
    });

    it('get_project denies outsiders', async () => {
      await expectToolError(
        outsider,
        'get_project',
        { projectId: project.id },
        'Project not found',
      );
    });

    it('list_boards filters by project', async () => {
      const { data } = await callTool(editor, 'list_boards', { projectId: project.id });

      expect(data.boards.map(({ id }) => id)).to.have.members([board.id, otherBoard.id]);
    });

    it('list_boards returns nothing to outsiders', async () => {
      const { data } = await callTool(outsider, 'list_boards', { projectId: project.id });

      expect(data.boards).to.have.lengthOf(0);
    });

    it('get_board returns lists, labels and members', async () => {
      const { data } = await callTool(viewer, 'get_board', { boardId: board.id });

      expect(data.board.id).to.equal(board.id);
      expect(data.lists.map(({ id }) => id)).to.include.members([list.id, otherList.id]);
      expect(data.labels.map(({ id }) => id)).to.deep.equal([label.id]);
      expect(data.boardMemberships.map(({ userId }) => userId)).to.have.members([
        editor.id,
        viewer.id,
      ]);
      expect(data).not.to.have.property('cards');
    });

    it('get_board denies outsiders', async () => {
      await expectToolError(outsider, 'get_board', { boardId: board.id }, 'Board not found');
    });
  });

  describe('cards', () => {
    it('create_card appends to the end of the list', async () => {
      const first = await createCard({ name: 'First' });
      const second = await createCard({ name: 'Second', description: 'Details' });

      expect(first.listId).to.equal(list.id);
      expect(first.type).to.equal(Card.Types.PROJECT);
      expect(second.position).to.be.greaterThan(first.position);
      expect(second.description).to.equal('Details');
    });

    it('create_card denies viewers', async () => {
      await expectToolError(
        viewer,
        'create_card',
        { listId: list.id, name: 'Nope' },
        'Not enough rights',
      );
    });

    it('create_card denies outsiders', async () => {
      await expectToolError(
        outsider,
        'create_card',
        { listId: list.id, name: 'Nope' },
        'List not found',
      );
    });

    it('create_card rejects invalid arguments before running the action', async () => {
      const result = await callTool(editor, 'create_card', { listId: 'abc', name: 'Card' });

      expect(result.isError).to.equal(true);
    });

    it('get_card returns the card with its relations', async () => {
      const card = await createCard();
      const { data } = await callTool(viewer, 'get_card', { cardId: card.id });

      expect(data.item.id).to.equal(card.id);
      expect(data.included).to.have.keys(
        'cardMemberships',
        'cardLabels',
        'taskLists',
        'tasks',
        'customFieldGroups',
        'customFields',
        'customFieldValues',
        'users',
        'attachments',
      );
    });

    it('get_card denies outsiders', async () => {
      const card = await createCard();

      await expectToolError(outsider, 'get_card', { cardId: card.id }, 'Card not found');
    });

    it('list_cards returns the cards of a board or one list', async () => {
      const card = await createCard();
      const { item: otherCard } = (
        await callTool(editor, 'create_card', { listId: otherList.id, name: 'Other' })
      ).data;

      const { data: boardData } = await callTool(viewer, 'list_cards', { boardId: board.id });
      const boardCardIds = boardData.cards.map(({ id }) => id);

      expect(boardCardIds).to.include.members([card.id, otherCard.id]);

      const { data: listData } = await callTool(viewer, 'list_cards', {
        boardId: board.id,
        listId: otherList.id,
      });

      expect(listData.cards.map(({ listId }) => listId)).to.satisfy((listIds) =>
        listIds.every((listId) => listId === otherList.id),
      );
      expect(listData.cards.map(({ id }) => id)).to.include(otherCard.id);
    });

    it('list_cards reads archive lists', async () => {
      const card = await createCard({ name: 'Archived' });
      await callTool(editor, 'move_card', { cardId: card.id, listId: archiveList.id });

      const { data } = await callTool(viewer, 'list_cards', {
        boardId: board.id,
        listId: archiveList.id,
      });

      expect(data.cards.map(({ id }) => id)).to.include(card.id);
    });

    it('list_cards rejects a list of another board', async () => {
      await expectToolError(
        editor,
        'list_cards',
        { boardId: board.id, listId: otherBoardList.id },
        'List not found',
      );
    });

    it('list_cards denies outsiders', async () => {
      await expectToolError(outsider, 'list_cards', { boardId: board.id }, 'Board not found');
    });

    it('search_cards matches every word in name or description', async () => {
      const match = await createCard({ name: `Login ${suffix}`, description: 'broken redirect' });
      await createCard({ name: `Login ${suffix}`, description: 'works' });

      const { data } = await callTool(viewer, 'search_cards', {
        boardId: board.id,
        query: `login ${suffix} REDIRECT`,
      });

      expect(data.cards.map(({ id }) => id)).to.deep.equal([match.id]);
    });

    it('search_cards denies outsiders', async () => {
      await expectToolError(
        outsider,
        'search_cards',
        { boardId: board.id, query: 'card' },
        'Board not found',
      );
    });

    it('update_card changes fields and clears the due date', async () => {
      const card = await createCard({ dueDate: '2030-01-01T00:00:00.000Z' });

      const { data } = await callTool(editor, 'update_card', {
        cardId: card.id,
        name: 'Renamed',
        dueDate: null,
      });

      expect(data.item.name).to.equal('Renamed');
      expect(data.item.dueDate).to.equal(null);
    });

    it('update_card denies viewers', async () => {
      const card = await createCard();

      await expectToolError(
        viewer,
        'update_card',
        { cardId: card.id, name: 'Nope' },
        'Not enough rights',
      );
    });

    it('move_card moves to the end of another list', async () => {
      const card = await createCard();
      const { data: target } = await callTool(editor, 'create_card', {
        listId: otherList.id,
        name: 'Target',
      });

      const { data } = await callTool(editor, 'move_card', {
        cardId: card.id,
        listId: otherList.id,
      });

      expect(data.item.listId).to.equal(otherList.id);
      expect(data.item.position).to.be.greaterThan(target.item.position);
    });

    it('move_card moves to another board', async () => {
      const card = await createCard();

      const { data } = await callTool(editor, 'move_card', {
        cardId: card.id,
        boardId: otherBoard.id,
        listId: otherBoardList.id,
      });

      expect(data.item.boardId).to.equal(otherBoard.id);
      expect(data.item.listId).to.equal(otherBoardList.id);
    });

    it('move_card denies viewers', async () => {
      const card = await createCard();

      await expectToolError(
        viewer,
        'move_card',
        { cardId: card.id, listId: otherList.id },
        'Not enough rights',
      );
    });

    it('delete_card deletes the card', async () => {
      const card = await createCard();

      const { data } = await callTool(editor, 'delete_card', { cardId: card.id });

      expect(data.item.id).to.equal(card.id);
      expect(await Card.qm.getOneById(card.id)).to.equal(undefined);
    });

    it('delete_card denies viewers', async () => {
      const card = await createCard();

      await expectToolError(viewer, 'delete_card', { cardId: card.id }, 'Not enough rights');
    });
  });

  describe('tasks', () => {
    it('create_task creates a task list when the card has none, then appends', async () => {
      const card = await createCard();

      const { data: first } = await callTool(editor, 'create_task', {
        cardId: card.id,
        name: 'First',
      });

      const { data: second } = await callTool(editor, 'create_task', {
        cardId: card.id,
        name: 'Second',
        isCompleted: true,
      });

      const taskLists = await TaskList.qm.getByCardId(card.id);

      expect(taskLists).to.have.lengthOf(1);
      expect(first.item.taskListId).to.equal(taskLists[0].id);
      expect(second.item.taskListId).to.equal(taskLists[0].id);
      expect(second.item.position).to.be.greaterThan(first.item.position);
      expect(second.item.isCompleted).to.equal(true);
    });

    it('create_task rejects a task list of another card', async () => {
      const card = await createCard();
      const otherCard = await createCard();

      const { data } = await callTool(editor, 'create_task', {
        cardId: otherCard.id,
        name: 'Task',
      });

      await expectToolError(
        editor,
        'create_task',
        { cardId: card.id, taskListId: data.item.taskListId, name: 'Task' },
        'Task list not found',
      );
    });

    it('create_task denies viewers', async () => {
      const card = await createCard();

      await expectToolError(
        viewer,
        'create_task',
        { cardId: card.id, name: 'Nope' },
        'Not enough rights',
      );
    });

    it('update_task completes and assigns a task', async () => {
      const card = await createCard();
      const { data: created } = await callTool(editor, 'create_task', {
        cardId: card.id,
        name: 'Task',
      });

      const { data } = await callTool(editor, 'update_task', {
        taskId: created.item.id,
        isCompleted: true,
        assigneeUserId: editor.id,
      });

      expect(data.item.isCompleted).to.equal(true);
      expect(data.item.assigneeUserId).to.equal(editor.id);
    });

    it('update_task denies viewers', async () => {
      const card = await createCard();
      const { data: created } = await callTool(editor, 'create_task', {
        cardId: card.id,
        name: 'Task',
      });

      await expectToolError(
        viewer,
        'update_task',
        { taskId: created.item.id, isCompleted: true },
        'Not enough rights',
      );
    });

    it('delete_task deletes the task', async () => {
      const card = await createCard();
      const { data: created } = await callTool(editor, 'create_task', {
        cardId: card.id,
        name: 'Task',
      });

      await callTool(editor, 'delete_task', { taskId: created.item.id });

      expect(await Task.qm.getOneById(created.item.id)).to.equal(undefined);
    });

    it('delete_task denies outsiders', async () => {
      const card = await createCard();
      const { data: created } = await callTool(editor, 'create_task', {
        cardId: card.id,
        name: 'Task',
      });

      await expectToolError(outsider, 'delete_task', { taskId: created.item.id }, 'Task not found');
    });
  });

  describe('labels and members', () => {
    it('add_label_to_card and remove_label_from_card', async () => {
      const card = await createCard();

      const { data: added } = await callTool(editor, 'add_label_to_card', {
        cardId: card.id,
        labelId: label.id,
      });

      expect(added.item.labelId).to.equal(label.id);

      const removed = await callTool(editor, 'remove_label_from_card', {
        cardId: card.id,
        labelId: label.id,
      });

      expect(removed.isError, removed.text).to.equal(false);

      expect(await CardLabel.qm.getByCardId(card.id)).to.have.lengthOf(0);
    });

    it('add_label_to_card denies viewers', async () => {
      const card = await createCard();

      await expectToolError(
        viewer,
        'add_label_to_card',
        { cardId: card.id, labelId: label.id },
        'Not enough rights',
      );
    });

    it('add_member_to_card and remove_member_from_card', async () => {
      const card = await createCard();

      const { data: added } = await callTool(editor, 'add_member_to_card', {
        cardId: card.id,
        userId: viewer.id,
      });

      expect(added.item.userId).to.equal(viewer.id);

      const removed = await callTool(editor, 'remove_member_from_card', {
        cardId: card.id,
        userId: viewer.id,
      });

      expect(removed.isError, removed.text).to.equal(false);

      const cardMemberships = await CardMembership.qm.getByCardId(card.id);

      expect(cardMemberships.map(({ userId }) => userId)).not.to.include(viewer.id);
    });

    it('add_member_to_card rejects users outside the board', async () => {
      const card = await createCard();

      await expectToolError(
        editor,
        'add_member_to_card',
        { cardId: card.id, userId: outsider.id },
        'User not found',
      );
    });

    it('remove_member_from_card denies viewers', async () => {
      const card = await createCard();
      await callTool(editor, 'add_member_to_card', { cardId: card.id, userId: editor.id });

      await expectToolError(
        viewer,
        'remove_member_from_card',
        { cardId: card.id, userId: editor.id },
        'Not enough rights',
      );
    });
  });

  describe('comments', () => {
    it('create_comment and list_comments', async () => {
      const card = await createCard();

      const { data: created } = await callTool(editor, 'create_comment', {
        cardId: card.id,
        text: 'Looks good',
      });

      expect(created.item.text).to.equal('Looks good');

      const { data } = await callTool(editor, 'list_comments', { cardId: card.id });

      expect(data.items.map(({ id }) => id)).to.deep.equal([created.item.id]);
    });

    it('create_comment denies viewers without comment rights', async () => {
      const card = await createCard();

      await expectToolError(
        viewer,
        'create_comment',
        { cardId: card.id, text: 'Nope' },
        'Not enough rights',
      );
    });

    it('list_comments denies outsiders', async () => {
      const card = await createCard();

      await expectToolError(outsider, 'list_comments', { cardId: card.id }, 'Card not found');
    });

    it('create_comment denies outsiders', async () => {
      const card = await createCard();

      await expectToolError(
        outsider,
        'create_comment',
        { cardId: card.id, text: 'Nope' },
        'Card not found',
      );
    });
  });
});
