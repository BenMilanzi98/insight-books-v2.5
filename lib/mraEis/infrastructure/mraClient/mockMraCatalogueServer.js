/**
 * Deterministic Mock MRA Catalogue + Inventory server.
 * Synthetic data only. No real credentials.
 */

const state = {
  scenario: 'SUCCESS',
  inventoryScenario: 'ACCEPTED',
  catalogueVersion: 'mock-cat-v1',
  submissions: new Map(),
};

export function resetMockCatalogueState() {
  state.scenario = 'SUCCESS';
  state.inventoryScenario = 'ACCEPTED';
  state.catalogueVersion = 'mock-cat-v1';
  state.submissions.clear();
}

export function setMockCatalogueScenario(scenario) {
  state.scenario = String(scenario || 'SUCCESS').toUpperCase();
}

export function setMockInventoryScenario(scenario) {
  state.inventoryScenario = String(scenario || 'ACCEPTED').toUpperCase();
}

function productFixture(siteId) {
  return [
    {
      type: 'PRODUCT',
      productCode: 'MOCK-P-001',
      name: 'Mock Standard Good',
      barcode: '6001001001001',
      unitOfMeasure: 'EA',
      sellingPrice: 1500,
      costPrice: 1000,
      quantity: 100,
      taxId: 'A',
      siteId,
      active: true,
      recordVersion: '1',
    },
    {
      type: 'PRODUCT',
      productCode: 'MOCK-P-ZERO',
      name: 'Mock Zero-Rated Good',
      barcode: '6001001001002',
      unitOfMeasure: 'EA',
      sellingPrice: 500,
      quantity: 50,
      taxId: 'B',
      siteId,
      active: true,
      recordVersion: '1',
    },
    {
      type: 'PRODUCT',
      productCode: 'MOCK-P-INACTIVE',
      name: 'Mock Inactive Good',
      barcode: '6001001001999',
      unitOfMeasure: 'EA',
      sellingPrice: 100,
      quantity: 0,
      taxId: 'A',
      siteId,
      active: false,
      status: 'INACTIVE',
      recordVersion: '1',
    },
  ];
}

function serviceFixture(siteId) {
  return [
    {
      type: 'SERVICE',
      serviceCode: 'MOCK-S-001',
      name: 'Mock Consulting Service',
      unitOfMeasure: 'HR',
      sellingPrice: 25000,
      taxId: 'A',
      siteId,
      active: true,
      recordVersion: '1',
    },
    {
      type: 'SERVICE',
      serviceCode: 'MOCK-S-002',
      name: 'Mock Maintenance',
      unitOfMeasure: 'EA',
      sellingPrice: 10000,
      taxId: 'A',
      siteId,
      active: true,
      recordVersion: '1',
    },
  ];
}

export async function mockGetCatalogue({ body = {}, method = 'POST' } = {}) {
  if (String(method).toUpperCase() !== 'POST') {
    return { httpStatus: 405, body: { statusCode: 0, remark: 'Method not allowed on mock — POST only' } };
  }

  const scenario = state.scenario;
  const siteId = body.siteId || 'MOCK-SITE-1';
  const tin = body.tin || 'TEST-TIN-0001';
  const externalType = String(body.externalType || 'PRODUCT').toUpperCase();

  if (scenario === 'TIMEOUT') {
    const err = new Error('Mock catalogue timeout');
    err.code = 'TIMEOUT';
    throw err;
  }
  if (scenario === 'HTTP_500') {
    return { httpStatus: 500, body: { statusCode: 0, remark: 'Upstream failure' } };
  }
  if (scenario === 'HTTP_429') {
    return { httpStatus: 429, body: { statusCode: 0, remark: 'Rate limited' } };
  }
  if (scenario === 'AUTH_FAILURE') {
    return { httpStatus: 401, body: { statusCode: 0, remark: 'Unauthorized' } };
  }
  if (scenario === 'TERMINAL_BLOCKED') {
    return { httpStatus: 200, body: { statusCode: 1, data: { version: state.catalogueVersion }, terminalBlocked: true } };
  }
  if (scenario === 'TIN_MISMATCH') {
    return {
      httpStatus: 200,
      body: {
        statusCode: 1,
        data: { version: state.catalogueVersion, tin: 'OTHER-TIN', siteId, products: productFixture(siteId) },
      },
    };
  }
  if (scenario === 'SITE_MISMATCH') {
    return {
      httpStatus: 200,
      body: {
        statusCode: 1,
        data: { version: state.catalogueVersion, tin, siteId: 'OTHER-SITE', products: productFixture(siteId) },
      },
    };
  }
  if (scenario === 'UNCHANGED') {
    return {
      httpStatus: 200,
      body: { statusCode: 1, data: { version: state.catalogueVersion, tin, siteId, unchanged: true } },
    };
  }
  if (scenario === 'EMPTY_VALID') {
    return {
      httpStatus: 200,
      body: { statusCode: 1, data: { version: state.catalogueVersion, tin, siteId, products: [], emptyValid: true } },
    };
  }
  if (scenario === 'SAME_VERSION_DIFF_CONTENT') {
    const products = productFixture(siteId);
    products[0].sellingPrice = 9999;
    return {
      httpStatus: 200,
      body: { statusCode: 1, data: { version: state.catalogueVersion, tin, siteId, products, complete: true } },
    };
  }
  if (scenario === 'DUPLICATE_BARCODE') {
    const products = productFixture(siteId);
    products[1].barcode = products[0].barcode;
    return {
      httpStatus: 200,
      body: { statusCode: 1, data: { version: `${state.catalogueVersion}-dup`, tin, siteId, products, complete: true } },
    };
  }
  if (scenario === 'INVALID_DECIMAL') {
    return {
      httpStatus: 200,
      body: {
        statusCode: 1,
        data: {
          version: state.catalogueVersion,
          tin,
          siteId,
          products: [{ productCode: 'X', name: 'Bad', sellingPrice: 'not-a-number', taxId: 'A', siteId }],
          complete: true,
        },
      },
    };
  }

  let items =
    externalType === 'SERVICE'
      ? serviceFixture(siteId)
      : externalType === 'COMBINED'
        ? [...productFixture(siteId), ...serviceFixture(siteId)]
        : productFixture(siteId);

  if (scenario === 'INACTIVATED') {
    items = items.map((i, idx) => (idx === 0 ? { ...i, active: false, status: 'INACTIVE' } : i));
  }

  const key = externalType === 'SERVICE' ? 'services' : 'products';
  return {
    httpStatus: 200,
    body: {
      statusCode: 1,
      remark: 'OK',
      data: {
        version: state.catalogueVersion,
        tin,
        siteId,
        [key]: items,
        complete: true,
      },
    },
  };
}

export async function mockSubmitInitialInventory({ snapshotId, idempotencyKey }) {
  const inv = state.inventoryScenario;
  if (inv === 'CONTRACT_UNVERIFIED') {
    return {
      httpStatus: 409,
      body: { statusCode: 0, remark: 'Initial Inventory contract unverified', code: 'INITIAL_INVENTORY_CONTRACT_UNVERIFIED' },
    };
  }
  if (inv === 'TIMEOUT') {
    const err = new Error('Mock inventory timeout');
    err.code = 'TIMEOUT';
    throw err;
  }
  if (inv === 'UNKNOWN') {
    return { httpStatus: 200, body: { statusCode: null, remark: 'Ambiguous' } };
  }
  if (inv === 'REJECTED') {
    return { httpStatus: 200, body: { statusCode: 0, remark: 'Rejected', errors: [{ code: 'INV_REJECT' }] } };
  }
  if (inv === 'DUPLICATE') {
    if (state.submissions.has(idempotencyKey || snapshotId)) {
      return state.submissions.get(idempotencyKey || snapshotId);
    }
  }
  const accepted = {
    httpStatus: 200,
    body: {
      statusCode: 1,
      remark: 'Accepted',
      data: { inventoryReference: `MOCK-INV-${snapshotId}`, acceptedAt: new Date().toISOString() },
    },
  };
  state.submissions.set(idempotencyKey || snapshotId, accepted);
  return accepted;
}
