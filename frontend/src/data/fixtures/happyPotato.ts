export const CANONICAL_BUSINESS = {
  "tenant": {
    "id": "HP-TENANT-DEMO",
    "name": "Happy Potato — SUC Demo"
  },
  "outlet": {
    "id": "HP-OUTLET-001",
    "name": "Happy Potato — Demo Outlet",
    "isFictional": true
  },
  "currency": "MYR",
  "businessTimezone": "Asia/Kuala_Lumpur",
  "fixtureBusinessDate": "2026-11-21",
  "simulationClockLocal": "09:00",
  "snapshot": {
    "id": "HP-SNAP-001",
    "revision": 1,
    "dataMode": "SYNTHETIC_BUSINESS",
    "fingerprint": ""
  },
  "primaryIncident": {
    "id": "HP-INC-001",
    "poId": "HP-PO-1042",
    "ingredientId": "HP-ING-CHICKEN",
    "incidentType": "UNAVAILABLE",
    "originalPoKgMilli": 20000,
    "supplierClaimedTodayKgMilli": 0,
    "poDeltaKgMilli": 20000,
    "verificationDefault": "PENDING_VERIFICATION"
  },
  "suppliers": [
    {
      "id": "HP-SUP-001",
      "name": "Demo Poultry Supply A",
      "synthetic": true
    },
    {
      "id": "HP-SUP-002",
      "name": "Demo Poultry Supply B",
      "synthetic": true
    },
    {
      "id": "HP-SUP-003",
      "name": "Demo Budget Frozen Foods",
      "synthetic": true
    },
    {
      "id": "HP-SUP-004",
      "name": "Demo Frozen Fries Distributor",
      "synthetic": true
    }
  ],
  "ingredients": [
    {
      "id": "HP-ING-CHICKEN",
      "name": "Chilled chicken",
      "unit": "kg",
      "requiredSpec": "CHILLED"
    },
    {
      "id": "HP-ING-FRIES",
      "name": "Frozen potato fries",
      "unit": "kg",
      "requiredSpec": "FROZEN"
    },
    {
      "id": "HP-ING-SEAS",
      "name": "Seasoning",
      "unit": "kg"
    },
    {
      "id": "HP-ING-OIL",
      "name": "Frying oil",
      "unit": "L"
    }
  ],
  "inventoryLots": [
    {
      "id": "HP-LOT-CH-001",
      "ingredientId": "HP-ING-CHICKEN",
      "onHandMilli": 10000,
      "unit": "kg",
      "accepted": true
    },
    {
      "id": "HP-LOT-FRIES-001",
      "ingredientId": "HP-ING-FRIES",
      "onHandMilli": 30000,
      "unit": "kg",
      "accepted": true
    },
    {
      "id": "HP-LOT-SEAS-001",
      "ingredientId": "HP-ING-SEAS",
      "onHandMilli": 3000,
      "unit": "kg",
      "accepted": true
    },
    {
      "id": "HP-LOT-OIL-001",
      "ingredientId": "HP-ING-OIL",
      "onHandMilli": 10000,
      "unit": "L",
      "accepted": true
    }
  ],
  "purchaseOrders": [
    {
      "id": "HP-PO-1042",
      "supplierId": "HP-SUP-001",
      "ingredientId": "HP-ING-CHICKEN",
      "expectedKgMilli": 20000,
      "dueTimeLocal": "10:00",
      "state": "OPEN"
    }
  ],
  "menuItems": [
    {
      "id": "HP-MENU-CP",
      "name": "Chicken Popcorn",
      "priceSen": 990,
      "chickenKgMilli": 150,
      "potatoFriesKgMilli": 0,
      "recipeVersion": "DEMO-v1",
      "approvedInDemo": true
    },
    {
      "id": "HP-MENU-CT",
      "name": "Chicken Tenders",
      "priceSen": 1190,
      "chickenKgMilli": 200,
      "potatoFriesKgMilli": 0,
      "recipeVersion": "DEMO-v1",
      "approvedInDemo": true
    },
    {
      "id": "HP-MENU-HC",
      "name": "Happy Combo — Chicken Popcorn",
      "priceSen": 1590,
      "chickenKgMilli": 100,
      "potatoFriesKgMilli": 180,
      "recipeVersion": "DEMO-v1",
      "approvedInDemo": true
    },
    {
      "id": "HP-MENU-FR",
      "name": "Flavoured Fries (Regular)",
      "priceSen": 790,
      "chickenKgMilli": 0,
      "potatoFriesKgMilli": 200,
      "recipeVersion": "DEMO-v1",
      "approvedInDemo": true
    }
  ],
  "forecastDemands": [
    {
      "menuId": "HP-MENU-CP",
      "portions": 60,
      "windowEndLocal": "14:30"
    },
    {
      "menuId": "HP-MENU-CT",
      "portions": 40,
      "windowEndLocal": "14:30"
    },
    {
      "menuId": "HP-MENU-HC",
      "portions": 50,
      "windowEndLocal": "14:30"
    },
    {
      "menuId": "HP-MENU-FR",
      "portions": 90,
      "windowEndLocal": "14:30"
    }
  ],
  "confirmedOrderGroups": [
    {
      "id": "HP-ORD-CP-01",
      "menuId": "HP-MENU-CP",
      "portions": 10,
      "dueTimeLocal": "12:30"
    },
    {
      "id": "HP-ORD-CP-02",
      "menuId": "HP-MENU-CP",
      "portions": 8,
      "dueTimeLocal": "12:30"
    },
    {
      "id": "HP-ORD-CP-03",
      "menuId": "HP-MENU-CP",
      "portions": 7,
      "dueTimeLocal": "12:30"
    },
    {
      "id": "HP-ORD-CT-01",
      "menuId": "HP-MENU-CT",
      "portions": 5,
      "dueTimeLocal": "12:30"
    },
    {
      "id": "HP-ORD-CT-02",
      "menuId": "HP-MENU-CT",
      "portions": 5,
      "dueTimeLocal": "12:30"
    },
    {
      "id": "HP-ORD-CT-03",
      "menuId": "HP-MENU-CT",
      "portions": 5,
      "dueTimeLocal": "12:30"
    },
    {
      "id": "HP-ORD-HC-01",
      "menuId": "HP-MENU-HC",
      "portions": 8,
      "dueTimeLocal": "12:30"
    },
    {
      "id": "HP-ORD-HC-02",
      "menuId": "HP-MENU-HC",
      "portions": 6,
      "dueTimeLocal": "12:30"
    },
    {
      "id": "HP-ORD-HC-03",
      "menuId": "HP-MENU-HC",
      "portions": 6,
      "dueTimeLocal": "12:30"
    },
    {
      "id": "HP-ORD-FR-01",
      "menuId": "HP-MENU-FR",
      "portions": 15,
      "dueTimeLocal": "12:30"
    },
    {
      "id": "HP-ORD-FR-02",
      "menuId": "HP-MENU-FR",
      "portions": 10,
      "dueTimeLocal": "12:30"
    },
    {
      "id": "HP-ORD-FR-03",
      "menuId": "HP-MENU-FR",
      "portions": 10,
      "dueTimeLocal": "12:30"
    }
  ],
  "supplierOffers": [
    {
      "id": "HP-OFFER-002",
      "supplierId": "HP-SUP-002",
      "ingredientId": "HP-ING-CHICKEN",
      "quantityKgMilli": 15000,
      "pricePerKgSen": 1600,
      "freightSen": 1500,
      "landedTotalSen": 25500,
      "etaLocal": "10:15",
      "spec": "CHILLED",
      "qualification": "QUALIFIED_CONDITIONAL",
      "provenance": "SYNTHETIC_BUSINESS"
    },
    {
      "id": "HP-OFFER-003",
      "supplierId": "HP-SUP-003",
      "ingredientId": "HP-ING-CHICKEN",
      "quantityKgMilli": 15000,
      "pricePerKgSen": 1400,
      "freightSen": 1000,
      "landedTotalSen": 22000,
      "etaLocal": "13:30",
      "spec": "FROZEN",
      "qualification": "INCOMPATIBLE",
      "provenance": "SYNTHETIC_BUSINESS"
    }
  ],
  "resources": [
    {
      "id": "HP-FRY-CH-A",
      "name": "Chicken Fryer A",
      "capability": "DEMO_CHICKEN_BATCH"
    },
    {
      "id": "HP-FRY-CH-B",
      "name": "Chicken Fryer B",
      "capability": "DEMO_CHICKEN_BATCH"
    },
    {
      "id": "HP-FRY-FRIES-A",
      "name": "Fries Fryer A",
      "capability": "DEMO_FROZEN_FRIES"
    }
  ]
} as const;
