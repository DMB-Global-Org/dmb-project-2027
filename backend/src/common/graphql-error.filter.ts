import { Catch } from '@nestjs/common';
import type { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

/**
 * Errors we throw on purpose (`appError`) are part of normal operation: a
 * failed login or a missing session is not a server fault. Hand them to the
 * client as they are instead of letting Nest log each one as an ERROR.
 */
@Catch(GraphQLError)
export class GraphQLErrorFilter implements GqlExceptionFilter {
  catch(error: GraphQLError): GraphQLError {
    return error;
  }
}
