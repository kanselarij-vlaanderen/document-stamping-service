
function authorizedSession (groups, authorizedGroups) {
  return Boolean(groups.find(groupObject => {
    return authorizedGroups.includes(groupObject.name);
  }));
}

export { authorizedSession };
