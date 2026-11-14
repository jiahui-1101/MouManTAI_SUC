import type { Menu } from "./planB";

const menuIds = ["HP-MENU-CP", "HP-MENU-CT", "HP-MENU-HC", "HP-MENU-FR"];
// P4-only anonymous tickets, ordered by acceptance time.
const ticketPortions = [
  [3,1,0,0], [2,2,0,0], [4,1,0,0], [1,2,2,5],
  [2,1,2,5], [3,0,3,5], [2,2,2,5], [1,2,2,4],
  [3,1,3,4], [2,1,2,3], [1,1,2,3], [1,1,2,1],
];

export function allocateDemoOrders(menus: Menu[], chicken: number, fries: number) {
  const recipes = menuIds.map(id => menus.find(menu => menu.id === id));
  if (menus.some(menu => menu.confirmed > 0 && !menuIds.includes(menu.id)) ||
      recipes.some((menu, index) => !menu?.approved ||
        menu.confirmed !== ticketPortions.reduce((sum, ticket) => sum + (ticket[index] ?? 0), 0))) return null;

  return ticketPortions.map((ticket, index) => {
    const items = ticket.flatMap((portions, menuIndex) => {
      const menu = recipes[menuIndex];
      return portions && menu ? [{ menuId: menu.id, name: menu.name, portions, chicken: portions * menu.chicken, fries: portions * menu.fries }] : [];
    });
    const requiredChicken = items.reduce((sum, item) => sum + item.chicken, 0);
    const requiredFries = items.reduce((sum, item) => sum + item.fries, 0);
    const chickenShort = Math.max(0, requiredChicken - chicken);
    const friesShort = Math.max(0, requiredFries - fries);
    chicken = Math.max(0, chicken - requiredChicken);
    fries = Math.max(0, fries - requiredFries);
    return {
      id: "HP-DEMO-ORD-" + String(index + 1).padStart(3, "0"),
      customer: "Demo customer " + (index + 1),
      accepted: "09:" + String(index * 3).padStart(2, "0"),
      deadline: 750,
      items, requiredChicken, requiredFries, chickenShort, friesShort,
      portions: items.reduce((sum, item) => sum + item.portions, 0),
      chickenPortions: items.reduce((sum, item) => sum + (item.chicken > 0 ? item.portions : 0), 0),
      atRisk: chickenShort > 0 || friesShort > 0,
    };
  });
}
