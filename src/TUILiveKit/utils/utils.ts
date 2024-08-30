export function safelyParse(data: string) {
  if (typeof data !== 'string') {
    return data;
  }
  let result;
  try {
    const tempData = JSON.parse(data);
    if (typeof tempData === 'object' && tempData) {
      result = tempData;
    } else {
      result = data;
    }
  } catch (error) {
    result = data;
  }
  return result;
}
