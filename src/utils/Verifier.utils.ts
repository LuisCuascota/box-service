import { Observable } from "rxjs";
import { CognitoJwtVerifier } from "aws-jwt-verify";

const verifier = CognitoJwtVerifier.create({
  userPoolId: "us-east-1_ikjEs7iIA",
  tokenUse: "access",
  clientId: "3mvj4vkukmiu27i8e1smp3eauc",
});
const isAuthJwt = async (event: any) => {
  try {
    const token = event.headers.Authorization;
    //const result = await verifier.verify(token);

    if (token) return true;

    return false;
  } catch (error: any) {
    return false;
  }
};

const resolveObservable = async <T>(
  observable: Observable<T>,
  event: object
) => {
  const resultPromise = new Promise<T>(async (resolve, reject) => {
    if (await isAuthJwt(event))
      observable.subscribe({
        next: (result: T) => {
          resolve(result);
        },
        error: (error) => {
          reject(error);
        },
      });
    else reject(new Error("No Autenticado"));
  });

  return await resultPromise;
};

export const processResponse = async <T>(
  observable: Observable<T>,
  event: object
) => {
  try {
    const result = await resolveObservable<T>(observable, event);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};
