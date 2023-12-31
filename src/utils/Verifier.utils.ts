import { CognitoJwtVerifier } from "aws-jwt-verify";
import { Callback } from "aws-lambda/handler";
import { Observable } from "rxjs";
import { SimpleJwksCache } from "aws-jwt-verify/jwk";
import { SimpleJsonFetcher } from "aws-jwt-verify/https";

const verifier = CognitoJwtVerifier.create(
  {
    userPoolId: "us-east-1_ikjEs7iIA",
    tokenUse: "access",
    clientId: "3mvj4vkukmiu27i8e1smp3eauc",
  },
  {
    jwksCache: new SimpleJwksCache({
      fetcher: new SimpleJsonFetcher({
        defaultRequestOptions: {
          responseTimeout: 8000,
        },
      }),
    }),
  }
);

export const verifyAuthJwt = (
  token: string,
  resolve: () => void,
  callback: Callback
) => {
  console.log(token, "ZZZZZZZ");

  verifier
    .verify(token)
    .then(() => {
      console.log(token, "KKKKKK");

      resolve();
    })
    .catch(() => {
      console.log(token, "SSSSSS");
      // @ts-ignore
      callback({ statusCode: 401 });
    });
};

const isAuthJwt = async (event: any) => {
  try {
    console.log("ANTES");
    const response = await fetch("https://fakestoreapi.com/products/1");

    const data = await response.json();

    console.log("DESPUES", data);

    await verifier.hydrate();

    const token = event.headers.Authorization;

    console.log(token);

    const result = await verifier.verify(token);

    console.log(result);

    return true;
  } catch (error: any) {
    console.log(error);

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
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};
