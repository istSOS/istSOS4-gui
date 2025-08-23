'use server'



export const fetchData = async (endpoint: string, token: string) => {

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Error fetching data: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        const data = JSON.parse(text);
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}


export const createData = async (
    endpoint: string,
    token: string,
    payload: Record<string, any>
) => {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                "accept": "application/json",
                "commit-message": "test",
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorMsg = `Error fetching data: ${response.status} ${response.statusText}`;
            try {
                const data = await response.json();
                if (data?.message) errorMsg = data.message;
            } catch { }
            throw new Error(errorMsg);
        }
        return await response.json().catch(() => true);
    } catch (error) {
        throw error;
    }
}

export const updateData = async (
  endpoint: string,
  token: string,
  payload: Record<string, any>
) => {
  try {
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        "accept": "application/json",
        "commit-message": "update",
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorMsg = `Error updating data: ${response.status} ${response.statusText}`;
      try {
        const data = await response.json();
        if (data?.message) errorMsg = data.message;
      } catch { }
      throw new Error(errorMsg);
    }
    return await response.json().catch(() => true);
  } catch (error) {
    throw error;
  }
}



export const deleteData = async (endpoint: string, token: string) => {

    try {
        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
                "accept": "application/json",
                "commit-message": "test",
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Error fetching data: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        //const data = JSON.parse(text);
        return text;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}
