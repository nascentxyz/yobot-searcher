const fs = require('fs');

const saveJson = (path: string, data: any) => {
  try {
    fs.writeFileSync(path, JSON.stringify(data));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
};

export default saveJson;
