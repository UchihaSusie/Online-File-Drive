const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });

async function createUsersTable() {
    const params = {
        TableName: 'cloud-drive-users',
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'email', AttributeType: 'S' }
        ],
        KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'email-index',
                KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
                Projection: { ProjectionType: 'ALL' }
            }
        ],
        Tags: [{ Key: 'Project', Value: 'CloudDrive' }]
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('SUCCESS: Users table created!');
    } catch (error) {
        if (error.name === 'ResourceInUseException') {
            console.log('INFO: Users table already exists');
        } else {
            console.error('ERROR:', error.message);
        }
    }
}

async function createDataTable() {
    const params = {
        TableName: 'cloud-drive-data',
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
            { AttributeName: 'PK', AttributeType: 'S' },
            { AttributeName: 'SK', AttributeType: 'S' },
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'type', AttributeType: 'S' }
        ],
        KeySchema: [
            { AttributeName: 'PK', KeyType: 'HASH' },
            { AttributeName: 'SK', KeyType: 'RANGE' }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'userId-type-index',
                KeySchema: [
                    { AttributeName: 'userId', KeyType: 'HASH' },
                    { AttributeName: 'type', KeyType: 'RANGE' }
                ],
                Projection: { ProjectionType: 'ALL' }
            }
        ],
        Tags: [{ Key: 'Project', Value: 'CloudDrive' }]
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('SUCCESS: Data table created!');
    } catch (error) {
        if (error.name === 'ResourceInUseException') {
            console.log('INFO: Data table already exists');
        } else {
            console.error('ERROR:', error.message);
        }
    }
}

async function createFilesTable() {
    const params = {
        TableName: 'cloud-drive-files',
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
            { AttributeName: 'fileId', AttributeType: 'S' },
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'createdAt', AttributeType: 'S' }
        ],
        KeySchema: [
            { AttributeName: 'fileId', KeyType: 'HASH' }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'userId-createdAt-index',
                KeySchema: [
                    { AttributeName: 'userId', KeyType: 'HASH' },
                    { AttributeName: 'createdAt', KeyType: 'RANGE' }
                ],
                Projection: { ProjectionType: 'ALL' }
            }
        ],
        Tags: [{ Key: 'Project', Value: 'CloudDrive' }]
    };

    try {
        await client.send(new CreateTableCommand(params));
        console.log('SUCCESS: Files table created!');
    } catch (error) {
        if (error.name === 'ResourceInUseException') {
            console.log('INFO: Files table already exists');
        } else {
            console.error('ERROR:', error.message);
        }
    }
}

async function waitForTable(tableName) {
    console.log('Waiting for ' + tableName + '...');
    let isActive = false;
    while (!isActive) {
        try {
            const response = await client.send(new DescribeTableCommand({ TableName: tableName }));
            if (response.Table.TableStatus === 'ACTIVE') {
                isActive = true;
                console.log('SUCCESS: ' + tableName + ' is active!');
            } else {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error('ERROR:', error.message);
            break;
        }
    }
}

async function main() {
    console.log('Creating DynamoDB tables...\n');
    await createUsersTable();
    await createDataTable();
    await createFilesTable();
    console.log('\nWaiting for tables...\n');
    await waitForTable('cloud-drive-users');
    await waitForTable('cloud-drive-data');
    await waitForTable('cloud-drive-files');
    console.log('\nDone! Tables created.');
}

main();