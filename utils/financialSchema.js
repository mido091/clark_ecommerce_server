import db from "../config/db.js";

let ensureFinancialColumnsPromise = null;

async function hasColumn(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName],
  );

  return rows.length > 0;
}

async function ensureFinancialColumnsWithConnection(connection) {
  const productHasNetProfit = await hasColumn(
    connection,
    "products",
    "net_profit",
  );
  if (!productHasNetProfit) {
    await connection.query(`
      ALTER TABLE products
      ADD COLUMN net_profit DECIMAL(10,2) NOT NULL DEFAULT 0.00
      AFTER price
    `);
  }

  const orderItemsHaveUnitNetProfit = await hasColumn(
    connection,
    "order_items",
    "unit_net_profit",
  );
  if (!orderItemsHaveUnitNetProfit) {
    await connection.query(`
      ALTER TABLE order_items
      ADD COLUMN unit_net_profit DECIMAL(10,2) NOT NULL DEFAULT 0.00
      AFTER price
    `);
  }
}

export async function ensureFinancialColumns(connection = null) {
  if (connection) {
    await ensureFinancialColumnsWithConnection(connection);
    return;
  }

  if (!ensureFinancialColumnsPromise) {
    ensureFinancialColumnsPromise = (async () => {
      const managedConnection = await db.getConnection();
      try {
        await ensureFinancialColumnsWithConnection(managedConnection);
      } finally {
        managedConnection.release();
      }
    })().catch((error) => {
      ensureFinancialColumnsPromise = null;
      throw error;
    });
  }

  await ensureFinancialColumnsPromise;
}
